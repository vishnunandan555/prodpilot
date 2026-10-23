# Render Static Site Deployment Guide for ProdPilot

ProdPilot uses **Model 1 architecture**:
- **Backend**: Runs on your laptop (`http://127.0.0.1:8765`), exposed publicly via Cloudflare Tunnel (`https://<subdomain>.trycloudflare.com`).
- **Frontend**: Hosted on Render as a high-performance static web application, accessible on mobile devices anywhere.

## 🚀 One-Click Render Static Site Deployment

1. **Create New Static Site on Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - Click **New +** $\rightarrow$ **Static Site**
   - Connect your `prodpilot` GitHub repository.

2. **Configure Build & Publish Settings**:
   - **Root Directory**: `desktop`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

3. **Configure Environment Variables**:
   - Add `VITE_API_URL`: `https://<your-cloudflare-tunnel>.trycloudflare.com`
   - *Tip*: You can also update the backend tunnel URL dynamically on the fly in the **Settings** tab in the web UI.

4. **SPA Rewrite Rule (Automatic via render.yaml)**:
   - Rewrite `/*` $\rightarrow$ `/index.html` to allow mobile navigation directly to `/incidents/:id`.
