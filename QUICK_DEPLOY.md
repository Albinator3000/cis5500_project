# Quick Deploy Checklist

Follow these steps in order for a successful deployment.

## ✅ Pre-Deployment Checklist

- [ ] Code is committed to GitHub
- [ ] `.env` files are in `.gitignore` (NOT committed)
- [ ] Both Render and Vercel accounts created
- [ ] Database password ready

## 🚀 Deployment Steps

### 1️⃣ Deploy Backend (Render)

1. Go to https://render.com → New → Web Service
2. Connect GitHub repo: `cis5500_project`
3. Settings:
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Instance Type: **Free**

4. Environment Variables (add all):
   ```
   PYTHON_VERSION=3.11.0
   DB_HOST=cis550-project-instance.c5m282o04n2q.us-east-1.rds.amazonaws.com
   DB_PORT=5432
   DB_NAME=cis550_project
   DB_USER=postgres
   DB_PASSWORD=[your_password]
   JWT_SECRET_KEY=[generate random 32+ chars]
   ```

5. Click **Create Web Service**
6. **Save your backend URL**: `https://your-service.onrender.com`

### 2️⃣ Deploy Frontend (Vercel)

1. Go to https://vercel.com → Add New → Project
2. Import GitHub repo: `cis5500_project`
3. Settings:
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. Environment Variables:
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   ```

5. Click **Deploy**
6. **Save your frontend URL**: `https://your-app.vercel.app`

### 3️⃣ Connect Backend to Frontend

1. Go to Render → Your backend service → Environment
2. Add variable:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
3. Save (auto-redeploys)

### 4️⃣ Set Up Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → New Project
2. APIs & Services → Credentials → Create OAuth Client ID
3. Configure:
   - Type: Web application
   - Origins: `https://your-app.vercel.app`
   - Redirect URIs: `https://your-app.vercel.app/login`

4. Copy **Client ID** and **Client Secret**

5. Add to Render (backend):
   ```
   GOOGLE_CLIENT_ID=[your client id]
   GOOGLE_CLIENT_SECRET=[your client secret]
   ```

6. Add to Vercel (frontend):
   ```
   VITE_GOOGLE_CLIENT_ID=[your client id]
   ```

7. Redeploy frontend on Vercel

### 5️⃣ Set Up GitHub OAuth

1. [GitHub Settings](https://github.com/settings/developers) → OAuth Apps → New
2. Configure:
   - Homepage URL: `https://your-app.vercel.app`
   - Callback URL: `https://your-app.vercel.app/login`

3. Copy **Client ID**, generate and copy **Client Secret**

4. Add to Render (backend):
   ```
   GITHUB_CLIENT_ID=[your client id]
   GITHUB_CLIENT_SECRET=[your client secret]
   ```

5. Add to Vercel (frontend):
   ```
   VITE_GITHUB_CLIENT_ID=[your client id]
   VITE_GITHUB_REDIRECT_URI=https://your-app.vercel.app/login
   ```

6. Redeploy frontend on Vercel

### 6️⃣ Test Everything

- [ ] Visit your app: `https://your-app.vercel.app`
- [ ] Test Google login
- [ ] Test GitHub login
- [ ] Navigate through all pages
- [ ] Check browser console for errors

## 🐛 Quick Troubleshooting

**Backend won't start?**
- Check Render logs
- Verify all env vars are set
- Check database connectivity

**Frontend build fails?**
- Check Vercel deployment logs
- Verify environment variables
- Check for TypeScript errors

**OAuth not working?**
- Verify URLs match exactly (no trailing slashes)
- Check redirect URIs in OAuth apps
- Clear browser cache and cookies

**API errors?**
- Check CORS settings (FRONTEND_URL must match)
- Verify backend is deployed and running
- Check browser network tab

## 📝 Your URLs

Write them down here:

```
Backend API: https://_________________.onrender.com
Frontend App: https://_________________.vercel.app

Google Client ID: _________________________________
GitHub Client ID: _________________________________
```

## 🎉 Done!

Your app is now live and accessible at your Vercel URL!

**Free tier includes:**
- ✅ Automatic SSL (HTTPS)
- ✅ Global CDN (fast worldwide)
- ✅ Automatic deployments on git push
- ✅ 750 hours/month backend (Render)
- ✅ Unlimited bandwidth frontend (Vercel)

**Note:** Render free tier spins down after 15 min inactivity. First request after will take ~30 seconds to wake up.

---

For detailed instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
