package com.fastshot.slitherproduction.flixplay.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import android.util.MalformedJsonException
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

private const val CATALOG_DB_VERSION = 5

private class CatalogDatabase(context: Context) :
  SQLiteOpenHelper(context, "flixplay_catalog.db", null, CATALOG_DB_VERSION) {
  init {
    // WAL: a grade de filmes/séries continua lendo páginas enquanto a
    // sincronização nativa grava em outra thread.
    setWriteAheadLoggingEnabled(true)
  }

  // Com WAL, "NORMAL" é seguro (o banco é só cache) e evita esperar o disco a
  // cada transação — a gravação de dezenas de milhares de títulos fica bem mais rápida.
  override fun onConfigure(db: SQLiteDatabase) {
    super.onConfigure(db)
    try { db.execSQL("PRAGMA synchronous=NORMAL") } catch (_: Exception) {}
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE catalog_items (
        server_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        item_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (server_id, kind, item_id)
      )
      """.trimIndent(),
    )
    CatalogQueries.install(db, false)
    // Índice por (server_id, kind): dentro dele as linhas ficam em ordem de rowid,
    // então "ORDER BY rowid" das páginas não precisa ordenar a tabela inteira a
    // cada página. A chave primária já cobre buscas por item_id.
    db.execSQL("CREATE INDEX catalog_kind_idx ON catalog_items(server_id, kind)")
  }

  // O banco é só um cache do catálogo: em qualquer troca de versão (inclusive
  // arquivos de versões antigas com outro esquema) ele é recriado e a próxima
  // sincronização o preenche de novo.
  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion == 4) CatalogQueries.install(db, true) else recreate(db)
  }

  override fun onDowngrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = recreate(db)

  private fun recreate(db: SQLiteDatabase) {
    val tables = mutableListOf<String>()
    db.rawQuery("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'android_metadata'", null).use { cursor ->
      while (cursor.moveToNext()) tables.add(cursor.getString(0))
    }
    for (table in tables) db.execSQL("DROP TABLE IF EXISTS \"$table\"")
    onCreate(db)
  }
}

/** Persistent, server-scoped catalog cache using Android's built-in SQLite. */
class CatalogDatabaseModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val database by lazy { CatalogDatabase(context) }

  override fun getName(): String = "FlixPlayCatalogDatabase"

  // Sincronização nativa de filmes/séries (CatalogStreamJob): uma por vez,
  // fora da thread dos módulos, para não travar as consultas da tela.
  private val streamExecutor = Executors.newSingleThreadExecutor()
  private val streamJobs = ConcurrentHashMap<String, CatalogStreamJob>()

  @ReactMethod
  fun streamCatalog(
    requestId: String,
    serverId: String,
    kind: String,
    url: String,
    timeoutMs: Double,
    categoriesJson: String,
    allowEmpty: Boolean,
    promise: Promise,
  ) {
    if (kind != "vodMovies" && kind != "seriesList") {
      promise.reject("INVALID_KIND", "Tipo de catálogo inválido")
      return
    }
    val categories = HashMap<String, String>()
    try {
      val json = JSONObject(categoriesJson)
      val keys = json.keys()
      while (keys.hasNext()) {
        val key = keys.next()
        categories[key] = json.optString(key)
      }
    } catch (_: Exception) {
    }
    val job = try {
      CatalogStreamJob(database.writableDatabase, serverId, kind, categories, streamBatchSize())
    } catch (_: Exception) {
      promise.reject("DB_UNAVAILABLE", "Banco local indisponível")
      return
    }
    streamJobs[requestId] = job
    streamExecutor.execute {
      try {
        val started = android.os.SystemClock.elapsedRealtime()
        val total = job.run(url, timeoutMs.toInt().coerceAtLeast(10_000), allowEmpty)
        val result = Arguments.createMap()
        result.putDouble("count", total.toDouble())
        result.putBoolean("committed", job.committed)
        result.putDouble("totalMs", (android.os.SystemClock.elapsedRealtime() - started).toDouble())
        result.putDouble("writeMs", job.writeMs.toDouble())
        result.putDouble("commitMs", job.commitMs.toDouble())
        promise.resolve(result)
      } catch (error: CatalogStreamException) {
        job.discard()
        promise.reject(error.code, error.message)
      } catch (_: MalformedJsonException) {
        job.discard()
        promise.reject("INVALID_JSON", "Resposta do servidor em formato inesperado")
      } catch (_: SocketTimeoutException) {
        job.discard()
        promise.reject("TIMEOUT", "O servidor demorou demais para responder")
      } catch (_: IOException) {
        job.discard()
        promise.reject("NETWORK", "Falha de rede ao baixar o catálogo")
      } catch (_: Exception) {
        job.discard()
        promise.reject("INVALID_JSON", "Resposta do servidor em formato inesperado")
      } finally {
        streamJobs.remove(requestId)
      }
    }
  }

  /** Aparelhos de até ~1,6 GB (Fire TV Stick, TVs simples): lotes menores, picos menores. */
  private fun streamBatchSize(): Int {
    return try {
      val manager = reactApplicationContext.getSystemService(android.content.Context.ACTIVITY_SERVICE) as? android.app.ActivityManager
      val memory = android.app.ActivityManager.MemoryInfo()
      manager?.getMemoryInfo(memory)
      val low = manager?.isLowRamDevice == true || (memory.totalMem in 1..(1600L * 1024 * 1024))
      if (low) CatalogStreamJob.LOW_MEMORY_BATCH_SIZE else CatalogStreamJob.DEFAULT_BATCH_SIZE
    } catch (_: Exception) {
      CatalogStreamJob.DEFAULT_BATCH_SIZE
    }
  }

  @ReactMethod
  fun catalogStreamProgress(requestId: String, promise: Promise) {
    promise.resolve((streamJobs[requestId]?.progress?.get() ?: -1).toDouble())
  }

  @ReactMethod
  fun cancelCatalogStream(requestId: String) {
    streamJobs[requestId]?.cancelled?.set(true)
  }

  @ReactMethod
  fun replaceAll(serverId: String, kind: String, json: String, promise: Promise) {
    try {
      val items = JSONArray(json)
      val db = database.writableDatabase
      db.beginTransaction()
      try {
        db.delete("catalog_items", "server_id = ? AND kind = ?", arrayOf(serverId, kind))
        val now = System.currentTimeMillis()
        for (index in 0 until items.length()) {
          val item = items.getJSONObject(index)
          val id = resolveId(item, index)
          val values = CatalogQueries.fields(item).apply {
            put("server_id", serverId)
            put("kind", kind)
            put("item_id", id)
            put("payload", item.toString())
            put("updated_at", now)
          }
          db.insertWithOnConflict("catalog_items", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        }
        db.setTransactionSuccessful()
      } finally {
        db.endTransaction()
      }
      promise.resolve(items.length())
    } catch (_: Exception) {
      promise.reject("CATALOG_WRITE_FAILED", "Não foi possível persistir o catálogo local.")
    }
  }

  /** Acrescenta itens sem apagar os existentes: permite gravar listas grandes em partes. */
  @ReactMethod
  fun append(serverId: String, kind: String, json: String, promise: Promise) {
    try {
      val items = JSONArray(json)
      val db = database.writableDatabase
      db.beginTransaction()
      try {
        val now = System.currentTimeMillis()
        for (index in 0 until items.length()) {
          val item = items.getJSONObject(index)
          val values = CatalogQueries.fields(item).apply {
            put("server_id", serverId)
            put("kind", kind)
            put("item_id", resolveId(item, index))
            put("payload", item.toString())
            put("updated_at", now)
          }
          db.insertWithOnConflict("catalog_items", null, values, SQLiteDatabase.CONFLICT_REPLACE)
        }
        db.setTransactionSuccessful()
      } finally {
        db.endTransaction()
      }
      promise.resolve(items.length())
    } catch (_: Exception) {
      promise.reject("CATALOG_WRITE_FAILED", "Não foi possível persistir o catálogo local.")
    }
  }

  /**
   * Troca a lista gravada em partes (kind "<kind>::staging") pela lista atual numa
   * única transação: se o app fechar no meio da gravação, o catálogo anterior
   * continua inteiro.
   */
  @ReactMethod
  fun commitStaging(serverId: String, kind: String, promise: Promise) {
    try {
      val db = database.writableDatabase
      db.beginTransaction()
      try {
        db.delete("catalog_items", "server_id = ? AND kind = ?", arrayOf(serverId, kind))
        val values = ContentValues().apply { put("kind", kind) }
        val moved = db.update("catalog_items", values, "server_id = ? AND kind = ?", arrayOf(serverId, "$kind::staging"))
        db.setTransactionSuccessful()
        promise.resolve(moved.toDouble())
      } finally {
        db.endTransaction()
      }
    } catch (_: Exception) {
      promise.reject("CATALOG_WRITE_FAILED", "Não foi possível persistir o catálogo local.")
    }
  }

  @ReactMethod
  fun count(serverId: String, kind: String, promise: Promise) {
    try {
      database.readableDatabase.rawQuery(
        "SELECT COUNT(*) FROM catalog_items WHERE server_id = ? AND kind = ?",
        arrayOf(serverId, kind),
      ).use { cursor ->
        promise.resolve(if (cursor.moveToFirst()) cursor.getInt(0).toDouble() else 0.0)
      }
    } catch (_: Exception) {
      promise.resolve(0.0)
    }
  }

  @ReactMethod
  fun queryPage(
    serverId: String,
    kind: String,
    offset: Double,
    limit: Double,
    promise: Promise,
  ) {
    try {
      val safeLimit = limit.toInt().coerceIn(1, 2000)
      val safeOffset = offset.toInt().coerceAtLeast(0)
      val result = JSONArray()
      database.readableDatabase.query(
        "catalog_items",
        arrayOf("payload"),
        "server_id = ? AND kind = ?",
        arrayOf(serverId, kind),
        null,
        null,
        // Ordem de gravação = ordem do servidor (numeração dos canais).
        "rowid ASC",
        "$safeOffset,$safeLimit",
      ).use { cursor ->
        while (cursor.moveToNext()) result.put(JSONObject(cursor.getString(0)))
      }
      promise.resolve(result.toString())
    } catch (_: Exception) {
      promise.reject("CATALOG_READ_FAILED", "Não foi possível ler o catálogo local.")
    }
  }

  @ReactMethod
  fun catalogPage(serverId: String, kind: String, options: String, offset: Double, limit: Double, promise: Promise) {
    try {
      promise.resolve(CatalogQueries.read(database.readableDatabase, serverId, kind, JSONObject(options), offset.toInt(), limit.toInt()))
    } catch (error: Exception) {
      promise.reject("CATALOG_READ_FAILED", error)
    }
  }

  @ReactMethod
  fun searchTvCatalog(server: String, term: String, kindsJson: String, offset: Double, limit: Double, promise: Promise) {
    try {
      val rows = JSONArray()
      val requested = JSONArray(kindsJson)
      val allowed = setOf("liveChannels", "vodMovies", "seriesList")
      val kinds = (0 until requested.length()).map { requested.getString(it) }.filter(allowed::contains).distinct()
      val placeholders = kinds.joinToString(",") { "?" }
      val needle = CatalogQueries.normalize(term)
      val args = (listOf(server) + kinds + listOf(needle, limit.toInt().coerceIn(1, 500).toString(), offset.toInt().coerceAtLeast(0).toString())).toTypedArray()
      database.readableDatabase.rawQuery("SELECT kind,payload FROM catalog_items WHERE server_id=? AND kind IN ($placeholders) AND instr(title_key,?)>0 ORDER BY kind,title_key,item_id LIMIT ? OFFSET ?", args).use { c ->
        while (c.moveToNext()) rows.put(JSONObject().put("kind", c.getString(0)).put("item", JSONObject(c.getString(1))))
      }
      promise.resolve(rows.toString())
    } catch (error: Exception) {
      promise.reject("CATALOG_READ_FAILED", error)
    }
  }

  @ReactMethod
  fun clearServer(serverId: String, promise: Promise) {
    try {
      database.writableDatabase.delete("catalog_items", "server_id = ?", arrayOf(serverId))
      promise.resolve(null)
    } catch (_: Exception) {
      promise.reject("CATALOG_DELETE_FAILED", "Não foi possível limpar o cache do servidor.")
    }
  }

  @ReactMethod
  fun clearAll(promise: Promise) {
    try {
      database.writableDatabase.delete("catalog_items", null, null)
      promise.resolve(null)
    } catch (_: Exception) {
      promise.reject("CATALOG_DELETE_FAILED", "Não foi possível limpar o cache local.")
    }
  }

  @ReactMethod
  fun getApproximateSize(promise: Promise) {
    try {
      val file = reactApplicationContext.getDatabasePath("flixplay_catalog.db")
      promise.resolve(if (file.exists()) file.length().toDouble() else 0.0)
    } catch (_: Exception) {
      promise.resolve(0.0)
    }
  }

  private fun resolveId(item: JSONObject, index: Int): String {
    val keys = arrayOf("id", "streamId", "seriesId", "category_id")
    for (key in keys) {
      val value = item.optString(key)
      if (value.isNotBlank()) return value
    }
    return index.toString()
  }
}
