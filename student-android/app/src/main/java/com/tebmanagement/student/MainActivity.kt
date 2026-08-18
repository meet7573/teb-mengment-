package com.tebmanagement.student

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

private const val API_BASE_URL = "https://teb-mengment.onrender.com"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { StudentApp() }
    }
}

@androidx.compose.runtime.Composable
private fun StudentApp() {
    var tabletId by remember { mutableStateOf("") }
    var pin by remember { mutableStateOf("") }
    var sessionToken by remember { mutableStateOf<String?>(null) }
    var active by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(28.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Text("TEB Student", style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.height(8.dp))
            Text("Tablet activation", style = MaterialTheme.typography.bodyLarge)
            Spacer(Modifier.height(24.dp))

            if (!active) {
                OutlinedTextField(
                    value = tabletId,
                    onValueChange = { tabletId = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Tablet ID") },
                    singleLine = true
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = pin,
                    onValueChange = { pin = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Student PIN") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true
                )
                Spacer(Modifier.height(20.dp))
                Button(
                    onClick = {
                        scope.launch {
                            val result = activate(tabletId.trim(), pin.trim())
                            status = result.message
                            sessionToken = result.token
                            active = result.token != null
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = tabletId.isNotBlank() && pin.isNotBlank()
                ) { Text("Activate Tablet") }
            } else {
                Text("Tablet: $tabletId", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                Text("Session active", style = MaterialTheme.typography.bodyLarge)
                Spacer(Modifier.height(20.dp))
                Button(
                    onClick = {
                        scope.launch {
                            val token = sessionToken
                            if (token == null) {
                                status = "Session token missing"
                                active = false
                            } else {
                                status = returnTablet(token)
                                if (status == "Returned successfully") {
                                    sessionToken = null
                                    active = false
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Return Tablet") }
            }

            if (status.isNotBlank()) {
                Spacer(Modifier.height(16.dp))
                Text(status)
            }
        }
    }
}

private val client = OkHttpClient()
private val jsonType = "application/json; charset=utf-8".toMediaType()

data class ActivationResult(val message: String, val token: String?)

private suspend fun activate(tabletId: String, pin: String): ActivationResult {
    return try {
        val body = JSONObject().put("tabletId", tabletId).put("pin", pin).toString()
        val request = Request.Builder()
            .url("$API_BASE_URL/api/student/activate")
            .post(body.toRequestBody(jsonType))
            .build()
        client.newCall(request).execute().use { response ->
            val responseBody = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                return ActivationResult("Activation failed (${response.code})", null)
            }
            val json = JSONObject(responseBody)
            val token = json.optString("sessionToken").takeIf { it.isNotBlank() }
            if (token == null) {
                ActivationResult("Activation response missing session token", null)
            } else {
                ActivationResult("Activated successfully", token)
            }
        }
    } catch (_: Exception) {
        ActivationResult("Unable to connect to TEB server", null)
    }
}

private suspend fun returnTablet(sessionToken: String): String {
    return try {
        val body = JSONObject().put("sessionToken", sessionToken).toString()
        val request = Request.Builder()
            .url("$API_BASE_URL/api/student/return")
            .post(body.toRequestBody(jsonType))
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return "Return failed (${response.code})"
            "Returned successfully"
        }
    } catch (_: Exception) {
        "Unable to connect to TEB server"
    }
}
