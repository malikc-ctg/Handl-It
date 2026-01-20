# ✅ NFG App - Operational Testing Checklist

**Purpose:** Ensure the app is ready for daily work operations  
**Focus:** Real-world workflows and common tasks

---

## 🎯 Core Workflows Testing

### 1. Quote Creation & Management
- [ ] **Create Standard Quote**
  - Fill out quote wizard (all steps)
  - Select existing account or create new one
  - Choose service type (dental, medical, restaurant, etc.)
  - Enter square footage, frequency, touchpoints
  - Review calculated price
  - Save quote
  - Verify quote appears in quotes list
  - Verify deal is auto-created in Kanban board

- [ ] **Create Walkthrough Quote**
  - Select "Walkthrough Required" option
  - Enter booking date and time
  - Complete all steps
  - Save quote
  - Verify welcome email is sent
  - Verify deal is created

- [ ] **Send Quote to Customer**
  - Open existing quote
  - Click "Send Quote" button
  - Verify email is sent successfully
  - Verify customer receives email with correct details

- [ ] **View Quote Details**
  - Open quote from list
  - Verify all information displays correctly
  - Verify pricing breakdown is accurate
  - Verify line items are shown

- [ ] **Edit Quote**
  - Open existing quote
  - Make changes to quote details
  - Save changes
  - Verify changes are saved correctly

---

### 2. Deal Management (Kanban Board)
- [ ] **View Deals**
  - Navigate to Sales > Deals
  - Verify Kanban board loads
  - Verify all deals are displayed in correct stages
  - Verify deal count is accurate

- [ ] **Move Deal Between Stages**
  - Drag deal from one stage to another
  - Verify deal moves correctly
  - Verify deal updates in real-time (if multiple users)
  - Refresh page and verify change persists

- [ ] **Create New Deal Manually**
  - Click "New Deal" button
  - Fill out deal form
  - Select account/contact
  - Set deal value and stage
  - Save deal
  - Verify deal appears in Kanban board

- [ ] **View Deal Details**
  - Click on deal card
  - Verify deal details display
  - Verify associated quotes are shown
  - Verify contact information is correct

- [ ] **Edit Deal**
  - Open deal details
  - Update deal value, stage, or notes
  - Save changes
  - Verify changes are reflected in Kanban board

---

### 3. Account & Contact Management
- [ ] **Create New Account**
  - Navigate to Accounts/Contacts
  - Click "New Account"
  - Enter company name, address, contact info
  - Save account
  - Verify account appears in list

- [ ] **Add Contact to Account**
  - Open existing account
  - Add new contact
  - Enter contact details (name, email, phone, role)
  - Save contact
  - Verify contact appears in account details

- [ ] **Search Accounts**
  - Use search bar to find account by name
  - Verify search results are accurate
  - Test with partial name matches

- [ ] **Edit Account**
  - Open existing account
  - Update account information
  - Save changes
  - Verify changes are saved

---

### 4. Job Management
- [ ] **Create New Job**
  - Navigate to Jobs
  - Click "New Job"
  - Select site, assign worker, set date/time
  - Add tasks
  - Save job
  - Verify job appears in jobs list

- [ ] **Start Job Timer**
  - Open job assigned to you
  - Click "Start Timer"
  - Verify timer starts counting
  - Perform some work
  - Click "Stop Timer"
  - Verify time is recorded

- [ ] **Complete Job Tasks**
  - Open job
  - Check off tasks as completed
  - Add photos to tasks (if required)
  - Verify task completion is saved
  - Verify job status updates when all tasks complete

- [ ] **Filter Jobs**
  - Filter by status (pending, in-progress, completed)
  - Filter by worker
  - Filter by site
  - Filter by date range
  - Verify filters work correctly

- [ ] **View Job Details**
  - Click on job from list
  - Verify all job information displays
  - Verify tasks are shown
  - Verify photos are displayed (if any)

---

### 5. Site Management
- [ ] **View Sites List**
  - Navigate to Sites
  - Verify all sites load
  - Verify site information displays correctly

- [ ] **Create New Site**
  - Click "New Site"
  - Enter site name, address, contact info
  - Save site
  - Verify site appears in list

- [ ] **View Site Details**
  - Click on site from list
  - Verify site details display
  - Verify associated jobs are shown
  - Verify worker assignments are shown

- [ ] **Edit Site**
  - Open site details
  - Update site information
  - Save changes
  - Verify changes are saved

- [ ] **Search Sites**
  - Use search to find site by name or address
  - Verify search works correctly

---

### 6. Messaging
- [ ] **Send Direct Message**
  - Navigate to Messages
  - Select or create conversation
  - Type and send message
  - Verify message appears in conversation
  - Verify recipient receives notification (if online)

- [ ] **Create Group Conversation**
  - Click "New Conversation"
  - Select multiple users
  - Send message
  - Verify all participants see message

- [ ] **Reply to Message**
  - Open existing conversation
  - Reply to specific message
  - Verify reply is threaded correctly

- [ ] **React to Message**
  - Click reaction button on message
  - Select emoji
  - Verify reaction appears
  - Verify other users see reaction

- [ ] **Search Messages**
  - Use search to find message by content
  - Verify search results are accurate

---

### 7. Inventory Management
- [ ] **View Inventory**
  - Navigate to Inventory
  - Verify inventory items load
  - Verify categories are displayed

- [ ] **Add Inventory Item**
  - Click "Add Item"
  - Enter item name, category, quantity
  - Set low stock threshold
  - Save item
  - Verify item appears in list

- [ ] **Update Item Quantity**
  - Open inventory item
  - Update quantity
  - Save changes
  - Verify quantity updates

- [ ] **Filter by Category**
  - Select category filter
  - Verify items filter correctly

- [ ] **Search Inventory**
  - Use search to find item
  - Verify search works

---

## 🔔 Notifications & Emails

### Email Testing
- [ ] **Walkthrough Welcome Email**
  - Create walkthrough quote
  - Verify email is sent to customer
  - Verify email contains correct business name and address
  - Verify email has NFG branding and logo
  - Verify company name and phone number are correct

- [ ] **Quote Email**
  - Send quote to customer
  - Verify email is sent
  - Verify email contains quote details
  - Verify pricing is correct
  - Verify email formatting is good

- [ ] **User Invitation Email**
  - Invite new user
  - Verify invitation email is sent
  - Verify invitation link works
  - Verify user can accept invitation

### Push Notifications
- [ ] **Job Assignment Notification**
  - Assign job to worker
  - Verify worker receives push notification
  - Verify notification is clickable

- [ ] **Message Notification**
  - Send message to user
  - Verify user receives push notification
  - Verify notification opens correct conversation

---

## 📱 Mobile & Responsive Testing

- [ ] **Mobile Navigation**
  - Test on mobile device or browser mobile view
  - Verify menu opens/closes correctly
  - Verify all pages are accessible
  - Verify forms are usable on mobile

- [ ] **Mobile Forms**
  - Test quote wizard on mobile
  - Test job creation on mobile
  - Test messaging on mobile
  - Verify all inputs are accessible

- [ ] **Touch Interactions**
  - Test tapping buttons
  - Test scrolling
  - Test drag-and-drop (Kanban board)
  - Verify interactions feel responsive

- [ ] **Tablet View**
  - Test on tablet-sized screen
  - Verify layout is appropriate
  - Verify all features work

---

## 🔐 Authentication & Access

- [ ] **Login**
  - Enter correct credentials
  - Verify login succeeds
  - Verify redirect to dashboard

- [ ] **Logout**
  - Click logout
  - Verify session ends
  - Verify redirect to login page

- [ ] **Role-Based Access**
  - Test as Admin user
  - Verify admin features are accessible
  - Test as Staff user
  - Verify staff-only features work
  - Verify admin-only features are hidden

- [ ] **Session Expiration**
  - Leave app idle for extended period
  - Try to perform action
  - Verify session expiration handling
  - Verify re-login works

---

## 🐛 Common Issues to Check

### Data Integrity
- [ ] **No Duplicate Records**
  - Create same account twice
  - Verify duplicate prevention or handling

- [ ] **Data Persistence**
  - Create quote, refresh page
  - Verify quote still exists
  - Verify all data is saved

- [ ] **Data Relationships**
  - Create quote linked to account
  - Delete account
  - Verify quote handling (cascade or error)

### Error Handling
- [ ] **Network Errors**
  - Disconnect internet
  - Try to save form
  - Verify error message
  - Reconnect and verify data syncs

- [ ] **Invalid Input**
  - Enter invalid email address
  - Enter negative numbers
  - Enter text in number fields
  - Verify validation messages appear

- [ ] **Missing Required Fields**
  - Try to submit form with empty required fields
  - Verify validation prevents submission
  - Verify clear error messages

### Performance
- [ ] **Page Load Speed**
  - Load dashboard with many jobs
  - Verify page loads in reasonable time (< 3 seconds)
  - Verify no freezing or lag

- [ ] **Real-Time Updates**
  - Open same page in two browsers
  - Make change in one browser
  - Verify change appears in other browser
  - Verify updates are timely

---

## 🎨 UI/UX Checks

- [ ] **Dark Mode**
  - Toggle dark mode
  - Verify all pages display correctly
  - Verify text is readable
  - Verify colors are appropriate

- [ ] **Loading States**
  - Perform actions that take time
  - Verify loading indicators appear
  - Verify user knows system is working

- [ ] **Toast Notifications**
  - Perform actions (save, delete, etc.)
  - Verify success/error messages appear
  - Verify messages are clear and helpful

- [ ] **Navigation**
  - Navigate between all main pages
  - Verify navigation is smooth
  - Verify active page is highlighted
  - Verify back button works

- [ ] **Form Validation**
  - Test all forms
  - Verify validation messages are clear
  - Verify invalid submissions are prevented
  - Verify valid submissions succeed

---

## 📊 Quick Smoke Tests

**Run these daily before starting work:**

1. [ ] Login works
2. [ ] Dashboard loads
3. [ ] Can create a quote
4. [ ] Can create a job
5. [ ] Can send a message
6. [ ] Kanban board displays deals
7. [ ] No console errors in browser
8. [ ] All pages are accessible

---

## 🚨 Critical Issues (Must Fix Before Production)

- [ ] **Data Loss**
  - No data is lost when saving
  - No data is lost on page refresh
  - No data is lost during network issues

- [ ] **Security**
  - Users can only see their own data (or authorized data)
  - Passwords are secure
  - No sensitive data in browser console

- [ ] **Core Functionality**
  - Quote creation works
  - Deal management works
  - Job management works
  - Messaging works

- [ ] **Email Delivery**
  - Emails are sent successfully
  - Email content is correct
  - Email formatting is professional

---

## 📝 Testing Notes Template

**Date:** _______________  
**Tester:** _______________  
**Browser/Device:** _______________

**Issues Found:**
1. [Issue description]
   - Severity: Critical / High / Medium / Low
   - Steps to reproduce:
   - Expected behavior:
   - Actual behavior:

**Overall Status:**
- [ ] Ready for production
- [ ] Needs fixes before production
- [ ] Major issues found

---

## ✅ Sign-Off Checklist

Before marking as production-ready:

- [ ] All core workflows tested and working
- [ ] No critical bugs found
- [ ] No data loss issues
- [ ] Email delivery working
- [ ] Mobile experience acceptable
- [ ] Performance is acceptable
- [ ] Security checks passed
- [ ] User acceptance testing completed

**Approved by:** _______________  
**Date:** _______________

---

**Last Updated:** 2025-01-23
