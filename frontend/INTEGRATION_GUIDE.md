# Backend Integration Guide

This document provides step-by-step instructions for integrating your backend API with this FlowMerce front-end application.

## Quick Start

### 1. Set Your Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_API_URL=https://your-api.com
NEXT_PUBLIC_API_KEY=your-api-key-from-backend
```

### 2. Test the Connection

Visit the signup page and try to create an account. The application will send:

```
POST https://your-api.com/api/auth/signup
Headers:
  Authorization: Bearer your-api-key-from-backend
  Content-Type: application/json

Body:
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123"
}
```

## API Endpoints Required

Your backend must implement these endpoints. All requests include the Bearer token in the Authorization header.

### Authentication Endpoints

#### POST `/api/auth/signup`
Create a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "secure_password"
}
```

**Response (Success - 200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response (Error - 400/409):**
```json
{
  "message": "Email already exists",
  "error": "DUPLICATE_EMAIL"
}
```

---

#### POST `/api/auth/login`
Authenticate an existing user.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "secure_password",
  "rememberMe": true
}
```

**Response (Success - 200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response (Error - 401):**
```json
{
  "message": "Invalid email or password",
  "error": "INVALID_CREDENTIALS"
}
```

---

#### POST `/api/auth/logout`
End the user session.

**Request:**
```json
{}
```

**Response (Success - 200):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### GET `/api/auth/me`
Get the current authenticated user.

**Response (Success - 200):**
```json
{
  "user": {
    "id": "user_123",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response (Error - 401):**
```json
{
  "message": "Unauthorized",
  "error": "INVALID_TOKEN"
}
```

---

#### POST `/api/auth/forgot-password`
Request a password reset.

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (Success - 200):**
```json
{
  "message": "Password reset email sent"
}
```

---

#### POST `/api/auth/reset-password`
Reset password with token (no Bearer auth needed).

**Request:**
```json
{
  "token": "reset_token_from_email",
  "password": "new_password"
}
```

**Response (Success - 200):**
```json
{
  "message": "Password reset successfully"
}
```

---

## Authentication Header Format

All authenticated requests must include:

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

Example with curl:
```bash
curl -X POST https://your-api.com/api/auth/login \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

## Using the API Utility Functions

The `/lib/api.ts` file provides pre-built functions for common operations:

### Signup
```typescript
import { signup } from '@/lib/api'

try {
  const response = await signup({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secure_password'
  })
  console.log('User created:', response.user)
  console.log('Token:', response.token)
} catch (error) {
  console.error('Signup failed:', error.message)
}
```

### Login
```typescript
import { login } from '@/lib/api'

try {
  const response = await login({
    email: 'john@example.com',
    password: 'secure_password',
    rememberMe: true
  })
  localStorage.setItem('authToken', response.token)
} catch (error) {
  console.error('Login failed:', error.message)
}
```

### Generic API Calls
```typescript
import { get, post, put, deleteRequest } from '@/lib/api'

// GET
const data = await get('/api/endpoint')

// POST
const result = await post('/api/endpoint', { key: 'value' })

// PUT
const updated = await put('/api/endpoint/1', { key: 'new-value' })

// DELETE
await deleteRequest('/api/endpoint/1')
```

### Custom API Calls
```typescript
import { apiCall } from '@/lib/api'

const response = await apiCall('/api/custom-endpoint', {
  method: 'POST',
  body: JSON.stringify({ data: 'value' })
})
```

## Implementation Examples

### Example 1: Backend in Node.js/Express

```javascript
// routes/auth.js
app.post('/api/auth/signup', authenticateApiKey, async (req, res) => {
  const { name, email, password } = req.body
  
  try {
    // Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' })
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists' })
    }
    
    // Create user
    const user = new User({ name, email, password })
    await user.save()
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET)
    
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    })
  } catch (error) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Middleware to verify API key
function authenticateApiKey(req, res, next) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token || token !== process.env.API_KEY) {
    return res.status(401).json({ message: 'Invalid API key' })
  }
  next()
}
```

### Example 2: Backend in Python/Flask

```python
from flask import Flask, request, jsonify
import jwt
import os

app = Flask(__name__)

def authenticate_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return {'message': 'Missing authorization header'}, 401
        
        parts = auth_header.split()
        if len(parts) != 2 or parts[0] != 'Bearer':
            return {'message': 'Invalid authorization header'}, 401
        
        token = parts[1]
        if token != os.getenv('API_KEY'):
            return {'message': 'Invalid API key'}, 401
        
        return f(*args, **kwargs)
    return decorated

@app.route('/api/auth/signup', methods=['POST'])
@authenticate_api_key
def signup():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not all([name, email, password]):
        return {'message': 'Missing required fields'}, 400
    
    # Check if user exists
    user = User.query.filter_by(email=email).first()
    if user:
        return {'message': 'Email already exists'}, 409
    
    # Create user
    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    # Generate token
    token = jwt.encode(
        {'userId': user.id},
        os.getenv('JWT_SECRET'),
        algorithm='HS256'
    )
    
    return {
        'token': token,
        'user': {'id': user.id, 'name': user.name, 'email': user.email}
    }, 200
```

### Example 3: Using with Next.js Backend

If you're running this frontend with a Next.js backend, create API routes:

```typescript
// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { message: 'Missing API key' },
        { status: 401 }
      )
    }
    
    const apiKey = authHeader.slice(7)
    if (apiKey !== process.env.API_KEY) {
      return NextResponse.json(
        { message: 'Invalid API key' },
        { status: 401 }
      )
    }
    
    const { name, email, password } = await request.json()
    
    // Validate
    if (!name || !email || !password) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Create user in database
    const user = await db.user.create({
      name,
      email,
      password: await hashPassword(password)
    })
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!
    )
    
    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    })
  } catch (error) {
    return NextResponse.json(
      { message: 'Server error' },
      { status: 500 }
    )
  }
}
```

## Error Handling

The application handles various error scenarios:

```typescript
// Common errors you should return:

// 400 - Bad Request (missing/invalid fields)
{ "message": "Email is required" }

// 401 - Unauthorized (invalid credentials or API key)
{ "message": "Invalid email or password" }

// 409 - Conflict (email already exists)
{ "message": "Email already exists" }

// 500 - Server Error
{ "message": "An error occurred" }
```

## Token Storage and Retrieval

After successful login/signup, the token is stored in `localStorage`:

```typescript
// Automatic (happens in the pages)
localStorage.setItem('authToken', response.token)

// Manual retrieval in components
const token = localStorage.getItem('authToken')

// For logout
localStorage.removeItem('authToken')
```

## Testing the Integration

### Using Postman

1. **Create environment variables:**
   - `api_url`: `https://your-api.com`
   - `api_key`: `your-api-key`

2. **Signup Request:**
   ```
   POST {{api_url}}/api/auth/signup
   Authorization: Bearer {{api_key}}
   Content-Type: application/json

   {
     "name": "Test User",
     "email": "test@example.com",
     "password": "test123"
   }
   ```

3. **Login Request:**
   ```
   POST {{api_url}}/api/auth/login
   Authorization: Bearer {{api_key}}
   Content-Type: application/json

   {
     "email": "test@example.com",
     "password": "test123"
   }
   ```

### Using cURL

```bash
# Signup
curl -X POST https://your-api.com/api/auth/signup \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123"
  }'

# Login
curl -X POST https://your-api.com/api/auth/login \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

## Troubleshooting

### "API key not configured"
- Verify `.env.local` exists with `NEXT_PUBLIC_API_KEY`
- Restart the dev server

### "Network Error" or CORS Issues
- Check backend is running at `NEXT_PUBLIC_API_URL`
- Verify CORS headers are configured on backend
- Check browser console for specific error messages

### "Invalid API key"
- Verify API key matches backend configuration
- Check Authorization header format is `Bearer KEY`

### "Redirect loop"
- Check that login/signup endpoints return a valid `token`
- Verify token is being stored in localStorage

## Security Best Practices

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **Use HTTPS in production** - Always encrypt in transit
3. **Rotate API keys regularly** - Change keys every 90 days
4. **Limit API key scope** - Use different keys for different environments
5. **Monitor usage** - Track API key usage for suspicious activity
6. **Use environment-specific keys** - Different keys for dev/staging/production

## Support

For issues with the frontend, check the main README.md.
For backend integration questions, refer to your backend documentation.
