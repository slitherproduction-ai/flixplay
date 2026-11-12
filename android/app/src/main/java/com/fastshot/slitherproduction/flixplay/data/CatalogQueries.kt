package com.fastshot.slitherproduction.flixplay.data

import android.content.ContentValues
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import java.text.Normalizer
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

internal object CatalogQueries {
  private val marks = Regex("\\p{M}+")
  fun normalize(text: String) = Normalizer.normalize(text, Normalizer.Form.NFD)
    .replace(marks, "").lowercase(Locale.ROOT)

  private val separators = Regex("[^a-z0-9]+")
  private val noise = "fhd 4k uhd hd hq sdr hdr hdr10 hevc h265 h264 x265 x264 dublado dublada legendado legendada dual".split(" ").toSet()
  private val tags = noise + "l leg sub legendas d dub nac nacional".split(" ")
  private val year = Regex("(19|20)[0-9]{2}")
  private fun words(text: String) = normalize(text).split(separators).filter { it.isNotEmpty() }

  // Mesmo critério de display.ts para reunir versões, inclusive no cache v4.
  private fun groupKey(title: String): String {
    if (!title.contains('[') && !title.contains('(')) return words(title).filterNot(noise::contains).joinToString(" ")
    val plain = StringBuilder()
    val enclosed = StringBuilder()
    val meaningful = mutableListOf<String>()
    var depth = 0
    for (c in title) {
      when {
        c == '[' || c == '(' -> { if (depth++ == 0) enclosed.setLength(0) }
        (c == ']' || c == ')') && depth > 0 -> {
          if (--depth == 0) {
            val part = words(enclosed.toString())
            if (part.any { it !in tags && !year.matches(it) }) meaningful.addAll(part)
          }
          plain.append(' ')
        }
        depth > 0 -> enclosed.append(c)
        else -> plain.append(c)
      }
    }
    return (words(plain.toString()) + meaningful).filterNot(noise::contains).joinToString(" ")
  }

  private fun addedTime(value: String): Long {
    value.toLongOrNull()?.let { return if (it in 1L..9999999999L) it * 1000 else it }
    if (value.isEmpty()) return 0
    val patterns = listOf("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd")
    for (pattern in patterns) {
      val parser = java.text.SimpleDateFormat(pattern, Locale.US)
      parser.timeZone = java.util.TimeZone.getTimeZone("UTC")
      val position = java.text.ParsePosition(0)
      val date = parser.parse(value, position)
      if (date != null && position.index == value.length) return date.time
    }
    return 0
  }

  fun fields(item: JSONObject): ContentValues = ContentValues().apply {
    val title = item.optString("title", item.optString("name"))
    put("title_key", normalize(title))
    put("group_key", groupKey(title))
    put("category", item.optString("genre", item.optString("categoryName")))
    put("category_id", item.optString("categoryId"))
    put("rating_value", item.optDouble("rating", 0.0))
    put("added_value", addedTime(item.optString("addedAt")))
  }

  fun install(db: SQLiteDatabase, backfill: Boolean) {
    for (column in listOf("title_key TEXT", "group_key TEXT", "category TEXT", "category_id TEXT", "rating_value REAL", "added_value INTEGER")) {
      db.execSQL("ALTER TABLE catalog_items ADD COLUMN $column")
    }
    if (backfill) {
      var last = 0L
      while (true) {
        var rows = 0
        db.rawQuery("SELECT rowid,payload FROM catalog_items WHERE rowid>? ORDER BY rowid LIMIT 200", arrayOf(last.toString())).use { cursor ->
          while (cursor.moveToNext()) {
            last = cursor.getLong(0)
            db.update("catalog_items", fields(JSONObject(cursor.getString(1))), "rowid=?", arrayOf(last.toString()))
            rows++
          }
        }
        if (rows < 200) break
      }
    }
    for ((suffix, columns) in listOf("category" to "category_id,category", "added" to "added_value DESC,item_id", "title" to "title_key,item_id", "group" to "group_key")) {
      db.execSQL("CREATE INDEX catalog_${suffix}_idx ON catalog_items(server_id,kind,$columns)")
    }
  }

  private fun literals(values: JSONArray): String = (0 until values.length()).joinToString(",") {
    DatabaseUtils.sqlEscapeString(values.getString(it))
  }

  fun read(db: SQLiteDatabase, server: String, kind: String, options: JSONObject, offset: Int, limit: Int): String {
    val clauses = mutableListOf("server_id=?", "kind=?")
    val args = mutableListOf(server, kind)
    val hidden = options.optJSONArray("hidden")
    if (hidden != null && hidden.length() > 0) clauses.add("category NOT IN (${literals(hidden)})")
    val category = options.optString("category")
    val id = options.optString("categoryId")
    if (id.isNotEmpty()) {
      clauses.add("(category_id=? OR (category_id='' AND category=?))")
      args.add(id)
      args.add(category)
    } else if (category.isNotEmpty()) {
      clauses.add("category=?")
      args.add(category)
    }
    options.optJSONArray("ids")?.let { clauses.add("item_id IN (${literals(it)})") }
    val query = normalize(options.optString("query").trim())
    val titles = options.optJSONArray("titles")
    if (query.isNotEmpty() || titles != null) {
      val matches = mutableListOf<String>()
      if (query.isNotEmpty()) {
        matches.add("(instr(title_key,?)>0 OR instr(group_key,?)>0)")
        args.add(query)
        args.add(query)
      }
      if (titles != null) matches.add("group_key IN (${literals(titles)})")
      clauses.add(matches.joinToString(" OR ", "(", ")"))
    }
    val where = clauses.joinToString(" AND ")
    val result = JSONArray()
    if (options.optBoolean("counts")) {
      db.rawQuery("SELECT category_id,category,count(*) FROM catalog_items WHERE $where GROUP BY category_id,category", args.toTypedArray()).use { c ->
        while (c.moveToNext()) result.put(JSONObject().put("id", c.getString(0)).put("name", c.getString(1)).put("total", c.getInt(2)))
      }
    } else {
      val order = when (options.optString("sort")) {
        "added_desc" -> "added_value DESC,item_id"
        "rating_desc" -> "rating_value DESC,title_key,item_id"
        "name_desc" -> "title_key DESC,item_id"
        // Ordem do servidor (canais ao vivo): a gravação segue a lista recebida.
        "position" -> "rowid"
        else -> "title_key,item_id"
      }
      db.rawQuery("SELECT payload FROM catalog_items WHERE $where ORDER BY $order LIMIT ? OFFSET ?", (args + limit.coerceIn(1, 500).toString() + offset.coerceAtLeast(0).toString()).toTypedArray()).use { c ->
        while (c.moveToNext()) result.put(JSONObject(c.getString(0)))
      }
    }
    return result.toString()
  }
}
