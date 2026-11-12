package com.fastshot.slitherproduction.flixplay.data

import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteStatement
import android.os.SystemClock
import android.util.JsonReader
import android.util.JsonToken
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/** Falha com código estável para o JS; a mensagem nunca leva a URL (tem usuário e senha). */
class CatalogStreamException(val code: String, message: String) : Exception(message)

/**
 * Baixa a lista de filmes ou séries do Xtream e grava direto na área temporária
 * (tabela `catalog_staging`, sem índices) do banco, item por item, numa thread própria:
 * - o JSON é lido em fluxo (JsonReader), sem nunca ter a lista inteira na memória;
 * - o JavaScript fica livre — a tela segue respondendo ao controle durante a sincronização;
 * - o mapeamento repete o de `mapVodStreamToMovie`/`mapSeriesStreamToItem`
 *   (services/xtream.ts), sem URL de reprodução nem credenciais no payload.
 *
 * Por que uma tabela à parte (2.17.52): gravar direto em `catalog_items`
 * mantinha 6 índices a cada linha e, na troca, o UPDATE de `kind` reescrevia
 * todos eles de novo — 42 dos 50 s da lista de 32 mil filmes no Fire TV Stick
 * 4K. Agora a área temporária só acumula linhas (sem índice nenhum) e a troca
 * copia tudo de uma vez, numa transação, com cache de páginas maior.
 */
internal class CatalogStreamJob(
  private val db: SQLiteDatabase,
  private val serverId: String,
  private val kind: String,
  private val categories: Map<String, String>,
  /** Lote por transação: menor em aparelhos de pouca memória (Fire TV Stick). */
  private val batchSize: Int = DEFAULT_BATCH_SIZE,
) {
  private val commitCacheKb = if (batchSize <= LOW_MEMORY_BATCH_SIZE) LOW_MEMORY_COMMIT_CACHE_KB else COMMIT_CACHE_KB

  val cancelled = AtomicBoolean(false)
  val progress = AtomicInteger(0)

  private val movies = kind == "vodMovies"
  private val batch = ArrayList<JSONObject>(batchSize)
  private var insert: SQLiteStatement? = null

  /** Tempos para o Diagnóstico → Desempenho. */
  var writeMs = 0L
    private set
  var commitMs = 0L
    private set
  var committed = false
    private set

  /**
   * Baixa, grava e — se `allowEmpty` ou vier algum item — troca a lista
   * gravada pela nova aqui mesmo, nesta thread (antes a troca rodava na
   * thread dos módulos e segurava as consultas da grade). Devolve o total.
   */
  fun run(url: String, timeoutMs: Int, allowEmpty: Boolean): Int {
    clearStaging()
    val total = try {
      download(url, timeoutMs)
    } finally {
      insert?.close()
      insert = null
    }
    if (total > 0 || allowEmpty) commit() else clearStaging()
    return total
  }

  private fun clearStaging() {
    db.delete(STAGING_TABLE, "server_id = ? AND kind = ?", arrayOf(serverId, kind))
  }

  /**
   * Troca a lista gravada pela nova numa só transação: apaga a antiga e copia
   * a área temporária na ordem do servidor (rowid), montando os índices de uma
   * vez. Leitores (grade, busca) seguem vendo a lista antiga até o fim (WAL).
   */
  private fun commit() {
    checkCancelled()
    val started = SystemClock.elapsedRealtime()
    // Mais páginas em memória só durante a cópia: os índices são montados
    // sem ir e voltar ao disco. Volta ao padrão logo depois.
    setCacheSize(commitCacheKb)
    db.beginTransaction()
    try {
      db.delete("catalog_items", "server_id = ? AND kind = ?", arrayOf(serverId, kind))
      db.execSQL(
        "INSERT OR REPLACE INTO catalog_items ($COLUMNS) SELECT $COLUMNS FROM $STAGING_TABLE " +
          "WHERE server_id = ? AND kind = ? ORDER BY rowid",
        arrayOf(serverId, kind),
      )
      db.delete(STAGING_TABLE, "server_id = ? AND kind = ?", arrayOf(serverId, kind))
      db.setTransactionSuccessful()
      committed = true
    } finally {
      db.endTransaction()
      setCacheSize(DEFAULT_CACHE_KB)
    }
    commitMs = SystemClock.elapsedRealtime() - started
  }

  private fun setCacheSize(kb: Int) {
    try {
      db.rawQuery("PRAGMA cache_size = -$kb", null).use { it.moveToFirst() }
    } catch (_: Exception) {
    }
  }

  private fun download(url: String, timeoutMs: Int): Int {
    val connection = open(url, timeoutMs)
    try {
      val input = BufferedReader(InputStreamReader(connection.inputStream, Charsets.UTF_8), 64 * 1024)
      // BOM no início (alguns painéis mandam): o JsonReader não aceita.
      input.mark(1)
      if (input.read() != 0xFEFF) input.reset()
      JsonReader(input).use { reader ->
        reader.isLenient = true
        readRoot(reader)
      }
      flush()
    } finally {
      connection.disconnect()
    }
    checkCancelled()
    return db.rawQuery("SELECT COUNT(DISTINCT item_id) FROM $STAGING_TABLE WHERE server_id = ? AND kind = ?", arrayOf(serverId, kind)).use { cursor ->
      if (cursor.moveToFirst()) cursor.getInt(0) else 0
    }
  }

  /** Apaga o que foi gravado na área temporária (falha ou cancelamento). */
  fun discard() {
    try {
      clearStaging()
    } catch (_: Exception) {
    }
  }

  private fun checkCancelled() {
    if (cancelled.get()) throw CatalogStreamException("CANCELLED", "Sincronização cancelada")
  }

  /** Segue redirecionamentos, inclusive http ↔ https (o HttpURLConnection sozinho não segue). */
  private fun open(start: String, timeoutMs: Int): HttpURLConnection {
    var target = start
    repeat(MAX_REDIRECTS) {
      checkCancelled()
      val connection = (URL(target).openConnection() as HttpURLConnection).apply {
        connectTimeout = minOf(timeoutMs, CONNECT_TIMEOUT_MS)
        readTimeout = timeoutMs
        instanceFollowRedirects = false
        setRequestProperty("User-Agent", USER_AGENT)
        setRequestProperty("Accept", "application/json, text/plain, */*")
      }
      val status = connection.responseCode
      if (status in 300..399) {
        val location = connection.getHeaderField("Location")
        connection.disconnect()
        if (location.isNullOrBlank()) throw CatalogStreamException("HTTP_$status", "Redirecionamento sem destino")
        target = URL(URL(target), location).toString()
        return@repeat
      }
      if (status !in 200..299) {
        connection.disconnect()
        throw CatalogStreamException("HTTP_$status", "Servidor respondeu HTTP $status")
      }
      return connection
    }
    throw CatalogStreamException("HTTP_REDIRECT", "Redirecionamentos demais")
  }

  private fun readRoot(reader: JsonReader) {
    when (reader.peek()) {
      JsonToken.BEGIN_ARRAY -> readArray(reader)
      JsonToken.BEGIN_OBJECT -> readObjectRoot(reader)
      else -> throw CatalogStreamException("INVALID_JSON", "Resposta não é uma lista")
    }
  }

  private fun readArray(reader: JsonReader) {
    reader.beginArray()
    while (reader.hasNext()) {
      checkCancelled()
      if (reader.peek() == JsonToken.BEGIN_OBJECT) readItem(reader) else reader.skipValue()
    }
    reader.endArray()
  }

  /** Formatos de clones: `{ "data": [...] }` ou `{ "1": {...}, "2": {...} }` (ver normalizeXtreamList). */
  private fun readObjectRoot(reader: JsonReader) {
    reader.beginObject()
    while (reader.hasNext()) {
      checkCancelled()
      val name = reader.nextName()
      val token = reader.peek()
      when {
        name in WRAPPER_KEYS && token == JsonToken.BEGIN_ARRAY -> readArray(reader)
        token == JsonToken.BEGIN_OBJECT && name.isNotEmpty() && name.all { it.isDigit() } -> readItem(reader)
        else -> reader.skipValue()
      }
    }
    reader.endObject()
  }

  private fun text(reader: JsonReader): String? = when (reader.peek()) {
    JsonToken.STRING, JsonToken.NUMBER -> reader.nextString()
    JsonToken.BOOLEAN -> reader.nextBoolean().toString()
    JsonToken.NULL -> { reader.nextNull(); null }
    else -> { reader.skipValue(); null }
  }

  private fun readItem(reader: JsonReader) {
    var id: String? = null
    var name = ""
    var icon = ""
    var rating = ""
    var added = ""
    var category: String? = null
    var extension = ""
    var plot = ""
    var year = ""
    var releaseDate = ""
    reader.beginObject()
    while (reader.hasNext()) {
      when (reader.nextName()) {
        "stream_id" -> if (movies) id = text(reader) else reader.skipValue()
        "series_id" -> if (!movies) id = text(reader) else reader.skipValue()
        "name" -> name = text(reader) ?: ""
        "stream_icon" -> if (movies) icon = text(reader) ?: "" else reader.skipValue()
        "cover" -> if (!movies) icon = text(reader) ?: "" else reader.skipValue()
        "rating" -> rating = text(reader) ?: ""
        "added" -> added = text(reader) ?: ""
        "category_id" -> category = text(reader)
        "container_extension" -> extension = text(reader) ?: ""
        "plot" -> plot = text(reader) ?: ""
        "year" -> year = text(reader) ?: ""
        "releaseDate" -> releaseDate = text(reader) ?: ""
        else -> reader.skipValue()
      }
    }
    reader.endObject()
    val rawId = id?.trim().orEmpty()
    if (rawId.isEmpty()) return

    val item = JSONObject()
    val score = (leadingNumber(rating) ?: 0.0).coerceIn(0.0, 10.0)
    if (movies) {
      item.put("id", "movie-$rawId")
      item.put("title", name)
      item.put("streamId", rawId)
      item.put("poster", icon)
      item.put("backdrop", icon)
      item.put("rating", score)
      item.put("year", leadingInt(year))
      item.put("duration", "N/A")
      item.put("genre", categories[category ?: ""] ?: "Geral")
      item.put("categoryId", category ?: "")
      item.put("plot", plot)
      item.put("containerExtension", extension.ifEmpty { "mp4" })
      quality(name)?.let { item.put("quality", it) }
      if (added.isNotEmpty() && added != "0") item.put("addedAt", added)
    } else {
      item.put("id", "series-$rawId")
      item.put("title", name)
      item.put("seriesId", rawId)
      item.put("poster", icon)
      item.put("backdrop", icon)
      item.put("rating", score)
      item.put("year", if (releaseDate.isNotEmpty()) leadingInt(releaseDate.take(4)) else 0)
      item.put("seasonsCount", 0)
      item.put("genre", categories[category ?: ""] ?: "Geral")
      item.put("categoryId", category ?: "")
      item.put("plot", plot)
    }
    batch.add(item)
    if (batch.size >= batchSize) flush()
  }

  private fun flush() {
    if (batch.isEmpty()) return
    checkCancelled()
    val started = SystemClock.elapsedRealtime()
    val now = System.currentTimeMillis()
    // Uma instrução compilada reaproveitada em lotes grandes: sem montar
    // ContentValues nem compilar o INSERT a cada item.
    val statement = insert ?: db.compileStatement(INSERT_SQL).also { insert = it }
    db.beginTransaction()
    try {
      for (item in batch) {
        val fields = CatalogQueries.fields(item)
        statement.clearBindings()
        statement.bindString(1, serverId)
        statement.bindString(2, kind)
        statement.bindString(3, item.getString("id"))
        statement.bindString(4, item.toString())
        statement.bindLong(5, now)
        bindText(statement, 6, fields.getAsString("title_key"))
        bindText(statement, 7, fields.getAsString("group_key"))
        bindText(statement, 8, fields.getAsString("category"))
        bindText(statement, 9, fields.getAsString("category_id"))
        statement.bindDouble(10, fields.getAsDouble("rating_value") ?: 0.0)
        val added = fields.getAsLong("added_value")
        if (added == null) statement.bindNull(11) else statement.bindLong(11, added)
        statement.executeInsert()
      }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
    progress.addAndGet(batch.size)
    batch.clear()
    writeMs += SystemClock.elapsedRealtime() - started
  }

  private fun bindText(statement: SQLiteStatement, index: Int, value: String?) {
    if (value == null) statement.bindNull(index) else statement.bindString(index, value)
  }

  companion object {
    const val DEFAULT_BATCH_SIZE = 2000
    const val LOW_MEMORY_BATCH_SIZE = 500
    const val STAGING_TABLE = "catalog_staging"
    private const val COLUMNS =
      "server_id, kind, item_id, payload, updated_at, title_key, group_key, category, category_id, rating_value, added_value"
    private const val INSERT_SQL = "INSERT INTO $STAGING_TABLE ($COLUMNS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    /** Padrão do SQLite do Android (2 MB). */
    private const val DEFAULT_CACHE_KB = 2000
    /** Cache da troca: 16 MB em geral, 6 MB em aparelhos de pouca memória. */
    private const val COMMIT_CACHE_KB = 16_000
    private const val LOW_MEMORY_COMMIT_CACHE_KB = 6_000

    /** Área temporária sem chave nem índices: só acumula linhas. */
    fun installStaging(db: SQLiteDatabase) {
      db.execSQL(
        "CREATE TABLE IF NOT EXISTS $STAGING_TABLE (server_id TEXT NOT NULL, kind TEXT NOT NULL, item_id TEXT NOT NULL, " +
          "payload TEXT NOT NULL, updated_at INTEGER NOT NULL, title_key TEXT, group_key TEXT, category TEXT, " +
          "category_id TEXT, rating_value REAL, added_value INTEGER)",
      )
    }
    private const val MAX_REDIRECTS = 6
    private const val CONNECT_TIMEOUT_MS = 20_000
    private const val USER_AGENT = "IPTVSmartersPro/3.1.5"
    private val WRAPPER_KEYS = setOf("data", "results", "streams", "categories", "series")
    private val UHD = Regex("\\b(4K|UHD)\\b", RegexOption.IGNORE_CASE)
    private val FHD = Regex("\\bFHD\\b|1080P", RegexOption.IGNORE_CASE)
    private val HD = Regex("\\bHD\\b|720P", RegexOption.IGNORE_CASE)
    private val NUMBER = Regex("^\\s*[+-]?(\\d+(\\.\\d*)?|\\.\\d+)([eE][+-]?\\d+)?")
    private val INTEGER = Regex("^\\s*[+-]?\\d+")

    private fun quality(name: String): String? = when {
      UHD.containsMatchIn(name) -> "4K"
      FHD.containsMatchIn(name) -> "FHD"
      HD.containsMatchIn(name) -> "HD"
      else -> null
    }

    /** Como `parseFloat` do JS: lê o número do começo do texto. */
    private fun leadingNumber(value: String): Double? =
      NUMBER.find(value)?.value?.trim()?.toDoubleOrNull()?.takeIf { !it.isNaN() && !it.isInfinite() }

    /** Como `parseInt(valor, 10) || 0` do JS. */
    private fun leadingInt(value: String): Int =
      INTEGER.find(value)?.value?.trim()?.toLongOrNull()?.toInt() ?: 0
  }
}
