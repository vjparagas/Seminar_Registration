# API Reference

All backend endpoints follow a unified response shape:
- **Success**: `{ "ok": true, ...data }` with status 200.
- **Error**: `{ "ok": false, "error": "...", ...extra }` with status 400, 401, 404, 409, 422, or 500.

Authentication is managed via an `httpOnly` session cookie (`host_session`), issued upon login and validated both at the network edge (`proxy.ts`) and within each individual route handler.

Notes for the frontend:
- 400 error messages come from input validation and may change in wording. Display the `error` text to the user and do not match on exact strings.
- `GET /api/sheet/check` is not documented here. It is owned by Member 3.
- Accepted rows use the field names `checkinStatus` and `checkinTime` (lowercase "i").

---

## 1. POST /api/auth/login

Logs in the host and sets the `host_session` cookie (valid for 8 hours).

- **Auth**: Public
- **Request Body**:
  ```json
  {
    "password": "your_secure_host_password"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "message": "Logged in successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request` (missing password):
    ```json
    {
      "ok": false,
      "error": "Invalid input: expected string, received undefined"
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "ok": false,
      "error": "Invalid password"
    }
    ```
  - `500 Internal Server Error`:
    ```json
    {
      "ok": false,
      "error": "HOST_PASSWORD is not configured on the server"
    }
    ```

---

## 2. POST /api/auth/logout

Logs out the host and clears the `host_session` cookie.

- **Auth**: Host session required
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "message": "Logged out successfully"
  }
  ```
- **Error Response (401 Unauthorized)**:
  ```json
  {
    "ok": false,
    "error": "Unauthorized"
  }
  ```

---

## 3. GET /api/registrants

Reads form responses from the Google Sheet, performs form standard validation on headers, filters out already accepted attendees and duplicate emails, and returns the cleaned registrants list alongside skipped rows.

- **Auth**: Host session required
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "registrants": [
      {
        "email": "charlie@example.com",
        "name": "Charlie Brown",
        "organization": "Delta Co",
        "contact": "09191234567",
        "timestamp": "2026-11-19T08:10:00Z",
        "extra": {
          "Dietary Needs": "Halal"
        }
      }
    ],
    "skipped": [
      {
        "row": 5,
        "email": "charlie@example.com",
        "reason": "Duplicate email (earliest kept)"
      },
      {
        "row": 6,
        "email": "not-an-email",
        "reason": "Invalid email address"
      },
      {
        "row": 7,
        "email": "noname@example.com",
        "reason": "Name is missing"
      }
    ]
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    {
      "ok": false,
      "error": "Unauthorized"
    }
    ```
  - `422 Unprocessable Entity` (Form Check failure):
    ```json
    {
      "ok": false,
      "error": "Form check failed: standard titles are missing or duplicated",
      "missing": ["Email Address"],
      "duplicates": []
    }
    ```
  - `500 Internal Server Error`:
    ```json
    {
      "ok": false,
      "error": "Failed to load registrants: <error message>"
    }
    ```

---

## 4. GET /api/accepted

Retrieves all accepted attendees from the `Accepted` tab, including check-in state, email status, and overall attendance statistics.

- **Auth**: Host session required
- **Request Body**: None
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "accepted": [
      {
        "ticketId": "TICK000001",
        "email": "alice@example.com",
        "name": "Alice Johnson",
        "organization": "Acme Corp",
        "contact": "09171234567",
        "acceptedAt": "2026-11-19T08:30:00.000Z",
        "emailStatus": "Sent",
        "checkinStatus": "Not Checked In",
        "checkinTime": ""
      },
      {
        "ticketId": "TICK000002",
        "email": "bob@example.com",
        "name": "Bob Smith",
        "organization": "Beta Inc",
        "contact": "09181234567",
        "acceptedAt": "2026-11-19T08:35:00.000Z",
        "emailStatus": "Sent",
        "checkinStatus": "Checked In",
        "checkinTime": "2026-11-19T09:00:00.000Z"
      }
    ],
    "stats": {
      "total": 2,
      "checkedIn": 1
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`:
    ```json
    {
      "ok": false,
      "error": "Unauthorized"
    }
    ```
  - `500 Internal Server Error`:
    ```json
    {
      "ok": false,
      "error": "Failed to load accepted list: <error message>"
    }
    ```

---

## 5. POST /api/accept

Accepts one or more registrants (1 to 20 emails per batch). Processing is performed sequentially. For each email:
1. Verifies the email is not already accepted in the sheet or being processed in-flight.
2. Generates a unique 10-character Ticket ID.
3. Appends a new row to the `Accepted` tab with `emailStatus: "Pending"` and `checkinStatus: "Not Checked In"`.
4. Generates a QR code containing solely the Ticket ID.
5. Sends a confirmation email with the QR code embedded as an inline attachment.
6. Updates Column G (`Email Status`) with `"Sent"` or `"Failed: reason"`.

- **Auth**: Host session required
- **Request Body**:
  ```json
  {
    "emails": [
      "charlie@example.com",
      "alice@example.com",
      "unknown@example.com"
    ]
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "results": [
      {
        "email": "charlie@example.com",
        "status": "accepted",
        "ticketId": "AB12CD34EF",
        "emailStatus": "Sent"
      },
      {
        "email": "alice@example.com",
        "status": "skipped",
        "reason": "Already accepted"
      },
      {
        "email": "unknown@example.com",
        "status": "skipped",
        "reason": "Not found in registrants"
      }
    ]
  }
  ```
  `status` is `accepted`, `skipped`, or `failed`. `failed` includes a `reason` and is used only when writing to the sheet fails. If the ticket was created but the email could not be sent, `status` is still `accepted` and `emailStatus` is `Failed: <reason>`.
- **Error Responses**:
  - `400 Bad Request` (empty list):
    ```json
    {
      "ok": false,
      "error": "At least one email is required"
    }
    ```
  - `400 Bad Request` (more than 20 emails):
    ```json
    {
      "ok": false,
      "error": "Cannot accept more than 20 emails at once"
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "ok": false,
      "error": "Unauthorized"
    }
    ```
  - `422 Unprocessable Entity`:
    ```json
    {
      "ok": false,
      "error": "Standard form columns missing in responses sheet"
    }
    ```
  - `500 Internal Server Error`:
    ```json
    {
      "ok": false,
      "error": "Failed to accept registrants: <error message>"
    }
    ```

---

## 6. POST /api/resend

Resends the ticket email with the embedded QR code to an already accepted attendee.

- **Auth**: Host session required
- **Request Body**:
  ```json
  {
    "ticketId": "AB12CD34EF"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "message": "Ticket email resent successfully",
    "ticketId": "AB12CD34EF",
    "email": "charlie@example.com"
  }
  ```
- **Error Responses**:
  - `400 Bad Request` (missing ticketId):
    ```json
    {
      "ok": false,
      "error": "Invalid input: expected string, received undefined"
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "ok": false,
      "error": "Unauthorized"
    }
    ```
  - `404 Not Found`:
    ```json
    {
      "ok": false,
      "error": "Ticket not found"
    }
    ```
  - `500 Internal Server Error` (example: email sending failed):
    ```json
    {
      "ok": false,
      "error": "Failed: Invalid login: 535-5.7.8 Username and Password not accepted"
    }
    ```

---

## 7. POST /api/checkin

Validates an attendee's Ticket ID, marks them as checked in, and stamps the check-in timestamp. The ticket ID is trimmed and uppercased before lookup, so a lowercase or space-padded value still works. Uses pre-update re-reading and an in-memory ticket lock to avoid race conditions.

- **Auth**: Host session required
- **Request Body**:
  ```json
  {
    "ticketId": "AB12CD34EF"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "ok": true,
    "name": "Charlie Brown",
    "organization": "Delta Co",
    "ticketId": "AB12CD34EF"
  }
  ```
- **Error Responses**:
  - `400 Bad Request` (missing ticketId):
    ```json
    {
      "ok": false,
      "error": "Invalid input: expected string, received undefined"
    }
    ```
  - `401 Unauthorized`:
    ```json
    {
      "ok": false,
      "error": "Unauthorized"
    }
    ```
  - `404 Not Found`:
    ```json
    {
      "ok": false,
      "error": "Invalid ticket"
    }
    ```
  - `409 Conflict` (Already checked in):
    ```json
    {
      "ok": false,
      "error": "Already checked in",
      "name": "Bob Smith",
      "checkedInAt": "2026-11-19T09:00:00.000Z"
    }
    ```
  - `500 Internal Server Error`:
    ```json
    {
      "ok": false,
      "error": "Failed to process check-in: <error message>"
    }
    ```