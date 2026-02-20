-- Enable extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Apartments
CREATE TABLE apartments (
    id SERIAL PRIMARY KEY,
    number VARCHAR(20) UNIQUE NOT NULL,
    floor INTEGER,
    block VARCHAR(10),
    area NUMERIC(10,2),
    status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('occupied', 'vacant')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Owners
CREATE TABLE owners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenants
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,
    rent_amount NUMERIC(10,2) DEFAULT 0,
    move_in_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance Payments
CREATE TABLE maintenance_payments (
    id SERIAL PRIMARY KEY,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- YYYY-MM
    amount_due NUMERIC(10,2) NOT NULL,
    amount_paid NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (Accounts)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    description TEXT,
    amount NUMERIC(12,2) NOT NULL,
    type VARCHAR(10) CHECK (type IN ('credit', 'debit')),
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed demo users (passwords: admin123 & manager123)
INSERT INTO users (username, password_hash, role) VALUES
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'),  -- bcrypt hash of "admin123"
('manager', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'manager')
ON CONFLICT DO NOTHING;

-- Optional: Seed sample data (run after tables)
INSERT INTO apartments (number, floor, block, area, status) VALUES
('A101', 1, 'A', 1200, 'occupied'),
('A102', 1, 'A', 1100, 'vacant')
ON CONFLICT DO NOTHING;