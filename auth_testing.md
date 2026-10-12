# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Step 1: Create Test User & Session (mongosh)
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

For admin testing use email `eduardo@eduescalante.com` so `is_admin` is true.

## Step 2: Test Backend API
```
curl -X GET "$API/api/auth/me" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "$API/api/me/stories" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "$API/api/me/portraits" -H "Authorization: Bearer YOUR_SESSION_TOKEN"
curl -X GET "$API/api/admin/metrics" -H "Authorization: Bearer ADMIN_SESSION_TOKEN"
```

## Step 3: Browser Testing (set cookie)
```
await page.context.add_cookies([{
  "name": "session_token", "value": "YOUR_SESSION_TOKEN",
  "domain": "<host>", "path": "/", "httpOnly": true, "secure": true, "sameSite": "None"
}])
```
Also can set localStorage `petito_token` = session_token (header fallback).

## Notes
- Create (POST /api/stories, /api/portraits) REQUIRES auth (401 without).
- Viewing shared links (GET /api/stories/slug/..., /api/portraits/slug/...) does NOT require auth.
- Admin allowlist via ADMIN_EMAILS env. Non-allowed email -> 403 "no autorizado".
- Callback detection in frontend uses useLocation().hash.
