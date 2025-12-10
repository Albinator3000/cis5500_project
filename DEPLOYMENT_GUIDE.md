# Free Deployment Guide - FundingAware App

This guide walks you through deploying your FundingAware application completely **FREE** using:
- **Render** (Free tier) for the backend API
- **Vercel** (Free tier) for the frontend React app

**Total Cost: $0/month**

---

## Prerequisites

- GitHub account (free)
- Render account (free) - sign up at https://render.com
- Vercel account (free) - sign up at https://vercel.com
- Your existing AWS RDS database (you already have this)

---

## Step 1: Push Your Code to GitHub

If you haven't already, initialize a git repository and push to GitHub:

```bash
cd /path/to/cis5500_project

# Initialize git if not already done
git add .
git commit -m "Prepare for deployment"

# Push to GitHub
git push origin main
```

**Important:** Make sure you have a `.gitignore` file that excludes:
```
.env
__pycache__/
node_modules/
dist/
.DS_Store
```

---

## Step 2: Deploy Backend to Render (FREE)

### 2.1 Create Render Account

1. Go to https://render.com
2. Sign up with your GitHub account
3. Authorize Render to access your repositories

### 2.2 Deploy the Backend

1. From your Render dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository `cis5500_project`
3. Configure the service:

   **Basic Settings:**
   - **Name**: `fundingaware-api` (or your choice)
   - **Region**: `Oregon (US West)` (free tier available)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

   **Instance Type:**
   - Select **"Free"** (provides 750 hours/month free)

4. Click **"Advanced"** and add environment variables:

   ```
   PYTHON_VERSION = 3.11.0

   DB_HOST = cis550-project-instance.c5m282o04n2q.us-east-1.rds.amazonaws.com
   DB_PORT = 5432
   DB_NAME = cis550_project
   DB_USER = postgres
   DB_PASSWORD = [your actual password]

   JWT_SECRET_KEY = [generate a random 32+ character string]

   GOOGLE_CLIENT_ID = [leave empty for now, will add after OAuth setup]
   GOOGLE_CLIENT_SECRET = [leave empty for now]
   GITHUB_CLIENT_ID = [leave empty for now]
   GITHUB_CLIENT_SECRET = [leave empty for now]

   FRONTEND_URL = [leave empty for now, will add after frontend deployment]
   ```

   **Generate JWT Secret:** Use a password generator or run:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

5. Click **"Create Web Service"**

6. Wait for deployment (5-10 minutes). You'll see build logs.

7. Once deployed, you'll get a URL like: `https://fundingaware-api.onrender.com`

   **SAVE THIS URL** - you'll need it for the frontend!

8. Test the API:
   - Visit: `https://fundingaware-api.onrender.com/health`
   - Should return: `{"status":"ok"}`

---

## Step 3: Deploy Frontend to Vercel (FREE)

### 3.1 Create Vercel Account

1. Go to https://vercel.com
2. Sign up with your GitHub account
3. Authorize Vercel to access your repositories

### 3.2 Deploy the Frontend

1. From Vercel dashboard, click **"Add New"** → **"Project"**
2. Import your GitHub repository `cis5500_project`
3. Configure the project:

   **Framework Preset:** Vite

   **Root Directory:** `frontend`

   **Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Environment Variables** - Click "Add" for each:

   ```
   VITE_API_URL = https://fundingaware-api.onrender.com

   VITE_GOOGLE_CLIENT_ID = [leave empty for now]

   VITE_GITHUB_CLIENT_ID = [leave empty for now]
   VITE_GITHUB_REDIRECT_URI = [leave empty for now, will be your Vercel URL + /login]
   ```

5. Click **"Deploy"**

6. Wait for deployment (2-5 minutes)

7. Once deployed, you'll get a URL like: `https://fundingaware.vercel.app`

   **SAVE THIS URL** - you need it for OAuth!

---

## Step 4: Update Backend with Frontend URL

1. Go back to Render dashboard
2. Select your `fundingaware-api` service
3. Go to **Environment** tab
4. Update the `FRONTEND_URL` variable:
   ```
   FRONTEND_URL = https://fundingaware.vercel.app
   ```
5. Click **"Save Changes"**
6. Render will automatically redeploy

---

## Step 5: Set Up Google OAuth

### 5.1 Create Google OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
5. Configure consent screen (if prompted):
   - User Type: External
   - App name: FundingAware
   - User support email: your email
   - Developer contact: your email
   - Click Save

6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `FundingAware Production`

   **Authorized JavaScript origins:**
   ```
   https://fundingaware.vercel.app
   ```

   **Authorized redirect URIs:**
   ```
   https://fundingaware.vercel.app
   https://fundingaware.vercel.app/login
   ```

7. Click **"Create"**
8. **Copy the Client ID and Client Secret**

### 5.2 Add Google Credentials to Backend

1. Go to Render dashboard → Your backend service
2. Go to **Environment** tab
3. Update these variables:
   ```
   GOOGLE_CLIENT_ID = [paste your Google Client ID]
   GOOGLE_CLIENT_SECRET = [paste your Google Client Secret]
   ```
4. Click **"Save Changes"**

### 5.3 Add Google Client ID to Frontend

1. Go to Vercel dashboard → Your project
2. Go to **Settings** → **Environment Variables**
3. Update:
   ```
   VITE_GOOGLE_CLIENT_ID = [paste your Google Client ID]
   ```
4. Click **"Save"**
5. Go to **Deployments** tab
6. Click **"Redeploy"** on the latest deployment

---

## Step 6: Set Up GitHub OAuth

### 6.1 Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `FundingAware`
   - **Homepage URL**: `https://fundingaware.vercel.app`
   - **Authorization callback URL**: `https://fundingaware.vercel.app/login`
4. Click **"Register application"**
5. **Copy the Client ID**
6. Click **"Generate a new client secret"** and copy it

### 6.2 Add GitHub Credentials to Backend

1. Go to Render dashboard → Your backend service
2. Go to **Environment** tab
3. Update:
   ```
   GITHUB_CLIENT_ID = [paste your GitHub Client ID]
   GITHUB_CLIENT_SECRET = [paste your GitHub Client Secret]
   ```
4. Click **"Save Changes"**

### 6.3 Add GitHub Client ID to Frontend

1. Go to Vercel dashboard → Your project
2. Go to **Settings** → **Environment Variables**
3. Add/Update:
   ```
   VITE_GITHUB_CLIENT_ID = [paste your GitHub Client ID]
   VITE_GITHUB_REDIRECT_URI = https://fundingaware.vercel.app/login
   ```
4. Click **"Save"**
5. Redeploy the frontend

---

## Step 7: Test Your Deployed App

1. Visit your Vercel URL: `https://fundingaware.vercel.app`

2. **Test Google OAuth:**
   - Click "Continue with Google"
   - Sign in with your Google account
   - You should be redirected to the dashboard

3. **Test GitHub OAuth:**
   - Logout (click your avatar)
   - Click "Continue with GitHub"
   - Authorize the app
   - You should be logged in

4. **Test API Connection:**
   - Check browser console for any errors
   - Try navigating different pages
   - Verify data loads correctly

---

## Step 8: Custom Domain (Optional)

### Vercel Custom Domain (Free)

1. Go to Vercel → Your project → **Settings** → **Domains**
2. Add your custom domain (e.g., `fundingaware.com`)
3. Follow DNS configuration instructions
4. Update OAuth redirect URIs in Google and GitHub

### Render Custom Domain (Free)

1. Go to Render → Your service → **Settings** → **Custom Domains**
2. Add your custom domain (e.g., `api.fundingaware.com`)
3. Configure DNS with CNAME record
4. Update `VITE_API_URL` in Vercel
5. Update `FRONTEND_URL` in Render

---

## Troubleshooting

### Backend Issues

**Build fails:**
- Check Render build logs
- Verify `requirements.txt` is correct
- Ensure Python version is compatible

**Database connection fails:**
- Verify RDS security group allows Render IPs
- Check database credentials in environment variables
- Test connection string

**API returns 500 errors:**
- Check Render logs: Dashboard → Service → Logs
- Verify all environment variables are set
- Check for missing dependencies

### Frontend Issues

**Build fails:**
- Check Vercel deployment logs
- Verify all dependencies in `package.json`
- Check for TypeScript errors

**OAuth doesn't work:**
- Verify redirect URIs match exactly (no trailing slashes)
- Check that Client IDs are correct
- Inspect browser console for errors
- Ensure cookies are enabled

**CORS errors:**
- Verify `FRONTEND_URL` is set in Render
- Check that it matches your Vercel URL exactly
- Redeploy backend after changing CORS settings

### Free Tier Limitations

**Render Free Tier:**
- Service spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- 750 hours/month free (sufficient for one service)

**Vercel Free Tier:**
- 100 GB bandwidth/month
- Fast global CDN
- Automatic SSL certificates
- No cold starts

**Solutions for Render spin-down:**
- Use a free uptime monitor (e.g., UptimeRobot) to ping every 10 minutes
- Accept the initial cold start
- Upgrade to paid tier ($7/month) for always-on

---

## Monitoring & Maintenance

### Render Monitoring

1. Dashboard → Service → Metrics
2. View CPU, memory, request counts
3. Set up email notifications for service health

### Vercel Monitoring

1. Dashboard → Project → Analytics
2. View page views, response times
3. Monitor build and deployment status

### Database Monitoring

1. AWS RDS Console
2. Monitor connections, CPU, storage
3. Set up CloudWatch alarms

---

## Updating Your App

### Update Backend

```bash
# Make changes to backend code
git add backend/
git commit -m "Update backend"
git push origin main

# Render automatically deploys on git push
# Check deployment status in Render dashboard
```

### Update Frontend

```bash
# Make changes to frontend code
git add frontend/
git commit -m "Update frontend"
git push origin main

# Vercel automatically deploys on git push
# Check deployment status in Vercel dashboard
```

### Manual Redeploy

**Render:** Dashboard → Service → Manual Deploy → Deploy latest commit

**Vercel:** Dashboard → Deployments → Click ⋯ → Redeploy

---

## Security Best Practices

1. **Never commit `.env` files** to GitHub
2. **Use strong JWT secrets** (32+ random characters)
3. **Rotate secrets periodically** (every 3-6 months)
4. **Monitor OAuth usage** in Google/GitHub consoles
5. **Set up 2FA** on all accounts (GitHub, Render, Vercel)
6. **Review access logs** regularly
7. **Keep dependencies updated** (`pip` and `npm` updates)

---

## Costs Summary

| Service | Tier | Cost |
|---------|------|------|
| Render Backend | Free | $0/month |
| Vercel Frontend | Free | $0/month |
| AWS RDS Database | (Existing) | (Your current cost) |
| GitHub | Free | $0/month |
| Google OAuth | Free | $0/month |
| GitHub OAuth | Free | $0/month |
| **Total New Costs** | | **$0/month** |

---

## Next Steps

- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel
- [ ] Set up Google OAuth
- [ ] Set up GitHub OAuth
- [ ] Test both login methods
- [ ] (Optional) Add custom domain
- [ ] (Optional) Set up uptime monitoring
- [ ] Share your app!

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Google OAuth Docs**: https://developers.google.com/identity/protocols/oauth2
- **GitHub OAuth Docs**: https://docs.github.com/en/developers/apps/building-oauth-apps

Your app is now deployed and ready to use! 🚀
