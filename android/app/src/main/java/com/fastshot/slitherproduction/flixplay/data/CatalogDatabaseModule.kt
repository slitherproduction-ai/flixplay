package com.fastshot.slitherproduction.flixplay.data

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONArray
import org.json.JSONObject

private class CatalogDatabase(context: Context) :
  SQLiteOpenHelper(context, "flixplay_catalog.db", null, 1) {
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
    db.execSQL("CREATE INDEX catalog_page_idx ON catalog_items(server_id, kind, item_id)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
}

/** Persistent, server-scoped catalog cache using Android's built-in SQLite. */
class CatalogDatabaseModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val database by lazy { CatalogDatabase(context) }

  override fun getName(): String = "FlixPlayCatalogDatabase"

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
          val values = ContentValues().apply {
            put("server_id", serverId)
            put("kind", kind)
            put("item_id", id)
            put("payload", item.toString())
            put("updated_at", now)
          }
          db.insertOrThrow("catalog_items", null, values)
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
        "item_id ASC",
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
