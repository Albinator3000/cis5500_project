# OAuth Setup Guide - Google & GitHub Authentication

This guide will help you set up Google and GitHub OAuth authentication for the FundingAware application.

## Overview

The authentication system uses:
- **Backend**: Python/FastAPI with JWT tokens
- **Frontend**: React/TypeScript with OAuth providers
- **Flow**: OAuth 2.0 authorization code flow for GitHub, ID token validation for Google

## Prerequisites

- Google Cloud Console account
- GitHub account
- Python 3.8+ installed
- Node.js 16+ installed

---

## Part 1: Backend Setup

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

The following packages will be installed:
- `python-jose[cryptography]` - JWT token handling
- `passlib[bcrypt]` - Password hashing (for future use)
- `httpx` - HTTP client for OAuth API calls
- `python-multipart` - Form data parsing

### 2. Configure Google OAuth

#### Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Configure the consent screen if prompted
6. For Application Type, select **Web application**
7. Add authorized JavaScript origins:
   - `http://localhost:5173` (for development)
   - Your production domain (when deploying)
8. Add authorized redirect URIs:
   - `http://localhost:5173` (for development)
   - Your production domain (when deploying)
9. Copy the **Client ID** and **Client Secret**

### 3. Configure GitHub OAuth

#### Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in the application details:
   - **Application name**: FundingAware (or your preferred name)
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `http://localhost:5173/login`
4. Click **Register application**
5. Copy the **Client ID**
6. Click **Generate a new client secret** and copy it

### 4. Create Backend .env File

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Database Configuration
DB_HOST=cis550-project-instance.c5m282o04n2q.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=cis550_project
DB_USER=postgres
DB_PASSWORD=your_actual_db_password

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-generate-a-random-string-here

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-actual-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your-actual-github-client-id
GITHUB_CLIENT_SECRET=your-actual-github-client-secret
```

**Important Security Notes:**
- Generate a strong random string for `JWT_SECRET_KEY` (at least 32 characters)
- Never commit the `.env` file to version control
- Use different credentials for production

### 5. Start the Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend API will be available at `http://localhost:8000`

---

## Part 2: Frontend Setup

### 1. Install Frontend Dependencies

```bash
cd frontend
npm install
```

The `@react-oauth/google` package should already be in package.json.

### 2. Create Frontend .env File

Create a `.env` file in the `frontend` directory:

```bash
cd frontend
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# API Configuration
VITE_API_URL=http://localhost:8000

# Google OAuth Configuration
VITE_GOOGLE_CLIENT_ID=your-actual-google-client-id.apps.googleusercontent.com

# GitHub OAuth Configuration
VITE_GITHUB_CLIENT_ID=your-actual-github-client-id
VITE_GITHUB_REDIRECT_URI=http://localhost:5173/login
```

**Note:** Only add the Google Client ID here (not the secret). The client secret stays on the backend.

### 3. Update main.tsx with Google OAuth Provider

Make sure your `frontend/src/main.tsx` has the GoogleOAuthProvider wrapper:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
```

### 4. Start the Frontend Server

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

---

## Part 3: Testing the Authentication

### Test Google OAuth

1. Navigate to `http://localhost:5173/login`
2. Click the **Continue with Google** button
3. Select your Google account
4. Grant permissions
5. You should be redirected to the dashboard with your user info

### Test GitHub OAuth

1. Navigate to `http://localhost:5173/login`
2. Click the **Continue with GitHub** button
3. Authorize the application
4. You should be redirected back and logged in

### Verify JWT Token

After logging in, check your browser's Developer Tools:
1. Open **Application > Local Storage > http://localhost:5173**
2. You should see an `auth_token` key with a JWT token value
3. This token is sent with all API requests in the `Authorization` header

---

## Part 4: Production Deployment

### Update OAuth Redirect URIs

For production deployment, you'll need to:

1. **Google Cloud Console**:
   - Add your production domain to authorized origins
   - Add production domain to redirect URIs

2. **GitHub OAuth App**:
   - Update Homepage URL to your production domain
   - Update Authorization callback URL to `https://yourdomain.com/login`

3. **Update Environment Variables**:
   - Backend: Update all credentials for production
   - Frontend: Update `VITE_API_URL` and `VITE_GITHUB_REDIRECT_URI`

### Security Considerations

- Use HTTPS in production (required for OAuth)
- Rotate JWT_SECRET_KEY regularly
- Set appropriate CORS origins in backend
- Use environment-specific credentials
- Enable OAuth app restrictions in Google Console
- Monitor OAuth usage and logs

---

## Troubleshooting

### Google OAuth Issues

**Error: "redirect_uri_mismatch"**
- Ensure the redirect URI in Google Console matches exactly
- Check for trailing slashes

**Error: "Invalid token"**
- Verify GOOGLE_CLIENT_ID in both backend and frontend
- Check that the backend can reach Google's API

### GitHub OAuth Issues

**Error: "bad_verification_code"**
- The authorization code may have expired (valid for 10 minutes)
- Ensure GITHUB_CLIENT_SECRET is correct

**Error: "redirect_uri_mismatch"**
- Verify the callback URL in GitHub settings matches your frontend

### General Issues

**CORS errors**
- Check that frontend URL is in backend's CORS allowed origins
- Ensure API_URL in frontend matches backend address

**JWT token invalid**
- Clear localStorage and try logging in again
- Verify JWT_SECRET_KEY is set in backend

---

## API Endpoints

### Authentication Endpoints

```
POST /api/auth/google
  Body: { "token": "google_id_token" }
  Returns: { "access_token": "jwt", "token_type": "bearer", "user": {...} }

POST /api/auth/github
  Body: { "code": "github_code", "redirect_uri": "callback_url" }
  Returns: { "access_token": "jwt", "token_type": "bearer", "user": {...} }

GET /api/auth/me
  Headers: { "Authorization": "Bearer jwt_token" }
  Returns: { "user": {...} }
```

### Using Protected Endpoints

To access protected endpoints, include the JWT token in the Authorization header:

```javascript
const token = authService.getToken();
const response = await axios.get('http://localhost:8000/api/symbols', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

---

## Architecture

```
┌─────────────┐          ┌──────────────┐          ┌─────────────┐
│   Frontend  │          │   Backend    │          │   OAuth     │
│   (React)   │          │  (FastAPI)   │          │  Providers  │
└──────┬──────┘          └──────┬───────┘          └──────┬──────┘
       │                        │                         │
       │  1. OAuth redirect     │                         │
       ├────────────────────────┼────────────────────────>│
       │                        │                         │
       │  2. Callback w/ code   │                         │
       │<───────────────────────┼─────────────────────────┤
       │                        │                         │
       │  3. Send code to API   │                         │
       ├───────────────────────>│                         │
       │                        │  4. Verify with OAuth   │
       │                        ├────────────────────────>│
       │                        │                         │
       │                        │  5. User info           │
       │                        │<────────────────────────┤
       │  6. JWT token + user   │                         │
       │<───────────────────────┤                         │
       │                        │                         │
       │  7. Use JWT for API    │                         │
       ├───────────────────────>│                         │
       │                        │                         │
```

---

## Next Steps

- [ ] Set up environment variables
- [ ] Test Google OAuth login
- [ ] Test GitHub OAuth login
- [ ] Configure production OAuth apps
- [ ] Deploy backend with proper secrets
- [ ] Deploy frontend with production URLs
- [ ] Test production authentication

For additional help, refer to:
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [FastAPI Security Documentation](https://fastapi.tiangolo.com/tutorial/security/)
