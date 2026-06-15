# Setup Checklist

Follow these steps to get your FlowMerce front-end running and integrated with your backend.

## ✅ Initial Setup

- [ ] Clone or download this repository
- [ ] Run `npm install` to install dependencies
- [ ] Copy `.env.example` to `.env.local`
- [ ] Update `.env.local` with your backend details:
  - [ ] `NEXT_PUBLIC_API_URL` - Your backend API URL (e.g., `https://api.example.com`)
  - [ ] `NEXT_PUBLIC_API_KEY` - API key from your backend

## ✅ Development

- [ ] Run `npm run dev` to start the development server
- [ ] Open [http://localhost:3000](http://localhost:3000) in your browser
- [ ] Test the landing page
- [ ] Test the signup page at [http://localhost:3000/signup](http://localhost:3000/signup)
- [ ] Test the login page at [http://localhost:3000/login](http://localhost:3000/login)

## ✅ Backend Integration

### Verify Backend Endpoints
- [ ] Backend has `/api/auth/signup` endpoint
- [ ] Backend has `/api/auth/login` endpoint
- [ ] Backend has `/api/auth/logout` endpoint
- [ ] Backend has `/api/auth/me` endpoint
- [ ] All endpoints accept `Authorization: Bearer {API_KEY}` header

### Test Signup
- [ ] Fill out the signup form with test data
- [ ] Click "GET STARTED"
- [ ] Verify the request reaches your backend
- [ ] Verify backend returns `{ token: "...", user: {...} }`
- [ ] Verify you're redirected to `/dashboard`
- [ ] Check browser console for any errors

### Test Login
- [ ] Navigate to [http://localhost:3000/login](http://localhost:3000/login)
- [ ] Enter test credentials
- [ ] Click "CONTINUE"
- [ ] Verify the request reaches your backend
- [ ] Verify backend returns `{ token: "...", user: {...} }`
- [ ] Verify you're redirected to `/dashboard`

### Test Error Handling
- [ ] Try signup with existing email
- [ ] Verify error message displays correctly
- [ ] Try login with wrong password
- [ ] Verify error message displays correctly
- [ ] Check that API errors are logged in console

## ✅ Before Production

### Security
- [ ] Ensure backend validates all input
- [ ] Ensure backend hashes passwords securely
- [ ] Ensure API key is not exposed in logs
- [ ] Ensure HTTPS is configured on backend
- [ ] Ensure CORS is properly configured

### Performance
- [ ] Test with slow network (DevTools Network tab)
- [ ] Verify loading states work correctly
- [ ] Test mobile responsiveness (DevTools)
- [ ] Verify error messages are user-friendly

### Functionality
- [ ] Test signup with various email formats
- [ ] Test password field shows/hides correctly
- [ ] Test "Remember me" checkbox works
- [ ] Test "Forgot Password" link (if implemented)
- [ ] Test social login placeholders (if implementing)
- [ ] Test logout functionality

## ✅ Deployment

### Vercel Deployment
- [ ] Create Vercel account if needed
- [ ] Connect GitHub repository (recommended)
- [ ] Add environment variables in Vercel dashboard:
  - [ ] `NEXT_PUBLIC_API_URL`
  - [ ] `NEXT_PUBLIC_API_KEY`
- [ ] Deploy to Vercel
- [ ] Test all pages on production URL
- [ ] Verify API requests are going to correct backend

### Alternative Deployment
- [ ] Run `npm run build` to create production build
- [ ] Test build locally with `npm run start`
- [ ] Deploy to your hosting provider
- [ ] Set environment variables on hosting provider
- [ ] Test all functionality on production

## ✅ Customization (Optional)

- [ ] Update FlowMerce branding in `/app/signup/page.tsx`
- [ ] Update FlowMerce branding in `/app/login/page.tsx`
- [ ] Update colors in pages (if desired)
- [ ] Update company logo (replace FM icon)
- [ ] Update page titles and descriptions in `layout.tsx`
- [ ] Add custom error messages

## ✅ Monitoring (Optional)

- [ ] Set up error tracking (e.g., Sentry)
- [ ] Set up analytics
- [ ] Monitor API usage
- [ ] Set up logs for authentication events
- [ ] Create alerts for failed login attempts

## 📚 Documentation

- [ ] Read `README.md` for overview
- [ ] Read `INTEGRATION_GUIDE.md` for backend integration details
- [ ] Review `/lib/api.ts` for available API functions
- [ ] Check backend API documentation

## 🆘 Troubleshooting

If you encounter issues:

1. **Check the console**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for error messages

2. **Check network requests**
   - Open DevTools (F12)
   - Go to Network tab
   - Try signup/login
   - Check if API request is being sent
   - Check response from backend

3. **Common issues**
   - "API key not configured" → Update `.env.local` and restart
   - "Network error" → Check `NEXT_PUBLIC_API_URL` is correct
   - "CORS error" → Backend CORS not configured correctly
   - "Invalid credentials" → Check backend validation logic

4. **Need help?**
   - Check `INTEGRATION_GUIDE.md` for API details
   - Review backend logs for errors
   - Check browser network tab for request details
   - Verify environment variables are set correctly

## 📝 Notes

- Keep your API key safe and never commit `.env.local`
- Use different API keys for development and production
- Consider implementing rate limiting on your backend
- Monitor for suspicious authentication attempts
- Regularly update dependencies

---

**Good luck! Your FlowMerce authentication system is ready to launch! 🚀**
