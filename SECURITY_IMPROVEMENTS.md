# Security Improvements and Photo Upload Feature

## Security Fixes Applied

### 1. SQL Injection Prevention
- **Fixed**: All database queries now use parameterized statements
- **Before**: Direct string concatenation in SQL queries
- **After**: Proper parameter binding with `?` placeholders
- **Impact**: Prevents SQL injection attacks

### 2. XSS (Cross-Site Scripting) Protection
- **Added**: Input sanitization function that escapes HTML characters
- **Sanitized inputs**: Username, bench names, and all user-generated content
- **Characters escaped**: `<`, `>`, `"`, `'`, `&`
- **Impact**: Prevents malicious script injection

### 3. Session Security Improvements
- **Enhanced**: Session IDs now use cryptographically secure random generation
- **Added**: Session expiration (24 hours)
- **Improved**: Session validation with proper database checks
- **Added**: Secure cookie attributes (HttpOnly, Secure, SameSite)
- **Impact**: Prevents session hijacking and fixation attacks

### 4. Input Validation
- **Username validation**: 3-20 characters, alphanumeric and underscores only
- **Password validation**: Minimum 6 characters
- **Coordinate validation**: Valid latitude/longitude ranges
- **File upload validation**: Image files only, 5MB size limit
- **Impact**: Prevents malformed data and potential security issues

### 5. File Upload Security
- **File type validation**: Only image files allowed
- **File size limits**: 5MB maximum
- **Image processing**: Automatic resizing and optimization
- **Secure file naming**: Unique filenames to prevent conflicts
- **Impact**: Prevents malicious file uploads

## New Photo Upload Feature

### Database Schema Updates
- Added `PhotoPath` column to `Lavicky` table
- Added `CreatedAt` timestamp for audit trail
- Added proper session expiration handling

### Photo Upload Functionality
- **Upload endpoint**: `/uploadPhoto` (POST)
- **File processing**: Automatic resizing to 800x600px max
- **Image optimization**: JPEG compression at 85% quality
- **Storage**: Files stored in `uploads/bench_photos/` directory
- **Security**: Only authenticated users can upload photos

### Frontend Updates
- **Photo display**: Bench markers show photos in popups
- **Upload interface**: "Add Photo" button for each bench
- **Responsive design**: Photos scale appropriately
- **User experience**: Immediate feedback on upload success/failure

## Setup Instructions

### 1. Install Dependencies
```bash
cd lavickyServer
npm install
```

### 2. Run Database Migration
```bash
node migrate_db.js
```

### 3. Start the Server
```bash
node server.js
```

### 4. Access the Application
- Open browser to `http://localhost:3000`
- Create an account or log in
- Add benches by clicking "Přidat lavičku" and clicking on the map
- Upload photos by clicking on bench markers and selecting "Add Photo"

## Security Best Practices Implemented

1. **Input Sanitization**: All user inputs are sanitized before processing
2. **Parameterized Queries**: All database operations use prepared statements
3. **Session Management**: Secure session handling with expiration
4. **File Upload Security**: Strict file type and size validation
5. **Error Handling**: Proper error responses without information leakage
6. **Authentication**: Session-based authentication for protected operations

## File Structure
```
lavickyServer/
├── server.js              # Main server with security fixes
├── migrate_db.js          # Database migration script
├── package.json           # Updated dependencies
├── uploads/               # Photo storage directory
│   └── bench_photos/      # Bench photos storage
├── static/
│   ├── page.js            # Updated with photo display
│   ├── page2.js           # Updated with photo upload
│   └── ...                # Other static files
└── users.db               # SQLite database
```

## Testing Security

### SQL Injection Test
Try entering malicious SQL in username field:
- Input: `admin'; DROP TABLE Users; --`
- Result: Properly sanitized and rejected

### XSS Test
Try entering script tags in bench name:
- Input: `<script>alert('XSS')</script>`
- Result: Properly escaped and displayed as text

### Session Security
- Sessions expire after 24 hours
- Session IDs are cryptographically secure
- Proper session validation on all protected endpoints

## Performance Improvements
- Image optimization reduces file sizes
- Automatic image resizing prevents oversized uploads
- Efficient database queries with proper indexing
- Secure file serving with appropriate MIME types
