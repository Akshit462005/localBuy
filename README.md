# LocalBuy - E-commerce Platform

LocalBuy is a full-stack e-commerce platform that connects local shopkeepers with customers. It features separate dashboards for shopkeepers and users, with capabilities for product management, shopping cart functionality, and order processing.

## 🚀 Features

### For Shopkeepers
- Secure authentication and authorization
- Product management (CRUD operations)
- Image upload for products
- Track product listings
- View their store's products

### For Users
- User registration and authentication
- Browse products from different shopkeepers
- Shopping cart functionality
- Place and track orders
- View order history

## 🛠️ Technical Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Session Management**: express-session
- **Password Hashing**: bcryptjs
- **File Upload**: multer

### Frontend
- **Template Engine**: EJS
- **Styling**: Custom CSS
- **Image Storage**: Local storage with public/uploads

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Products Table
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    shopkeeper_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Orders Table
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Order Items Table
```sql
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL
);
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=localbuy_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd localbuy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL**
   - Install PostgreSQL
   - Create a database named 'localbuy_db'
   - Update .env file with your PostgreSQL credentials

4. **Initialize the database**
   ```bash
   node scripts/reset-db.js
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

6. **Access the application**
   - Open http://localhost:3000 in your browser

### Test Accounts
- **Shopkeeper Account**
  - Email: shop@example.com
  - Password: test123

- **User Account**
  - Email: test@example.com
  - Password: test123

## 📁 Project Structure
```
localbuy/
├── migrations/
│   └── add_deleted_column.js
├── public/
│   ├── css/
│   │   └── style.css
│   └── uploads/          # Product images storage
├── scripts/
│   └── reset-db.js       # Database initialization
├── src/
│   ├── app.js           # Main application file
│   ├── middleware/
│   │   └── auth.js      # Authentication middleware
│   └── routes/
│       ├── auth.js      # Authentication routes
│       ├── shopkeeper.js # Shopkeeper routes
│       └── user.js      # User routes
├── tests/
│   ├── api-test.js
│   ├── db-test.js
│   └── route-test.js
└── views/
    ├── error.ejs
    ├── home.ejs
    ├── auth/
    │   ├── login.ejs
    │   └── register.ejs
    ├── shopkeeper/
    │   ├── add-product.ejs
    │   ├── dashboard.ejs
    │   └── edit-product.ejs
    └── user/
        ├── cart.ejs
        ├── dashboard.ejs
        └── orders.ejs
```

## 🔒 Security Features
- Password hashing using bcryptjs
- JWT-based authentication
- Session management
- Role-based access control
- SQL injection prevention through parameterized queries
- File upload validation and filtering

## 💾 Database Operations

### Check Database Status
```sql
-- Check users
SELECT * FROM users;

-- Check products
SELECT * FROM products;

-- Check orders with items
SELECT o.*, oi.quantity, oi.price, p.name 
FROM orders o 
JOIN order_items oi ON o.id = oi.order_id 
JOIN products p ON oi.product_id = p.id;
```

## 🔍 Testing

### Database Testing
```bash
node tests/db-test.js
```
Tests database connection and table structure

### API Testing
```bash
node tests/api-test.js
```
Tests API endpoints and functionality

### Route Testing
```bash
node tests/route-test.js
```
Tests authentication and middleware functionality

## 🛣️ API Routes

### Authentication Routes
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/logout` - User logout

### Shopkeeper Routes
- `GET /shopkeeper/dashboard` - View products
- `GET /shopkeeper/add-product` - Add product form
- `POST /shopkeeper/add-product` - Create product
- `GET /shopkeeper/edit-product/:id` - Edit product form
- `POST /shopkeeper/edit-product/:id` - Update product
- `POST /shopkeeper/delete-product/:id` - Delete product

### User Routes
- `GET /user/dashboard` - View all products
- `POST /user/add-to-cart` - Add to cart
- `GET /user/cart` - View cart
- `POST /user/update-cart` - Update cart
- `POST /user/checkout` - Process order
- `GET /user/orders` - View orders

## 🔄 Session Management
- Sessions are managed using express-session
- Cart data is stored in session
- JWT tokens are stored in session for authentication

## 📝 Error Handling
- Custom error pages
- Database error handling
- File upload error handling
- Authentication error handling

## 💻 Development
```bash
npm run dev
```
Runs the application with nodemon for development

## 🚀 Production
```bash
npm start
```
Runs the application in production mode