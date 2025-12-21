# Deployment Guide

This guide explains how to deploy Occupancy Editor to various hosting platforms.

## GitHub Pages

### Setup Steps:

1. **Enable GitHub Pages in Repository Settings:**
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**

2. **Push the workflow file:**
   - The `.github/workflows/deploy.yml` file is already configured
   - Push to the `main` branch to trigger automatic deployment

3. **Access your site:**
   - After deployment, your site will be available at:
   - `https://serboba.github.io/occupancy-editor/`

### Manual Deployment (Alternative):

If you prefer manual deployment:

```bash
npm run build
# Then upload the dist/ folder to GitHub Pages
```

## Vercel

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

   Or connect your GitHub repository at [vercel.com](https://vercel.com) for automatic deployments.

## Netlify

1. **Install Netlify CLI:**
   ```bash
   npm i -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   npm run build
   netlify deploy --prod --dir=dist
   ```

   Or drag and drop the `dist/` folder at [netlify.com](https://netlify.com).

## Other Static Hosts

Since this is a static site, you can deploy the `dist/` directory to:
- **Cloudflare Pages**
- **AWS S3 + CloudFront**
- **Azure Static Web Apps**
- **Any web server** (nginx, Apache, etc.)

Just run `npm run build` and upload the `dist/` folder contents.

