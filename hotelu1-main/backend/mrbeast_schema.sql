-- mrbeast_schema.sql

CREATE DATABASE IF NOT EXISTS mrbeast_db;
USE mrbeast_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subfranchise_id INT,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price FLOAT NOT NULL,
    category VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    image TEXT,
    isAvailable BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    status ENUM('pending', 'preparing', 'ready', 'delivered', 'completed', 'NOT_AVAILABLE') NOT NULL DEFAULT 'pending',
    total FLOAT NOT NULL,
    timestamp DATETIME NOT NULL,
    type VARCHAR(50) NOT NULL,
    bill_requested BOOLEAN DEFAULT FALSE,
    delivered_at DATETIME NULL,
    bill_generated BOOLEAN DEFAULT FALSE,
    payment_method VARCHAR(50) NULL,
    bill_status VARCHAR(50) DEFAULT 'pending',
    subfranchise_id INT,
    customer_id INT,
    updated_at DATETIME NULL,
    preparing_at DATETIME NULL,
    ready_at DATETIME NULL,
    chef_id INT,
    chef_name VARCHAR(255),
    source VARCHAR(50),
    external_order_id VARCHAR(255),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    delivery_address TEXT,
    token VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT NOT NULL,
    menuItemId INT,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    price FLOAT NOT NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menuItemId) REFERENCES menu_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_name VARCHAR(255) NOT NULL,
    current_stock FLOAT NOT NULL,
    min_stock FLOAT NOT NULL,
    status VARCHAR(50),
    unit_price FLOAT,
    unit VARCHAR(50),
    supplier VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orderId INT NOT NULL,
    subtotal FLOAT NOT NULL,
    tax FLOAT NOT NULL,
    total FLOAT NOT NULL,
    payment_method VARCHAR(50) NULL,
    bill_status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    generated_at DATETIME NOT NULL,
    paid_at DATETIME NULL,
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sub_franchises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    address VARCHAR(255),
    city VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    manager_name VARCHAR(255),
    status ENUM('active', 'inactive') DEFAULT 'active',
    notes TEXT,
    owner_user_id INT,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    isDefault BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category ENUM('user_management', 'menu_management', 'order_management', 'inventory_management', 'billing', 'reporting', 'settings') NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    permission_id INT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    permission_id INT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description VARCHAR(255),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);