-- Run this in phpMyAdmin for the MySQL database created in DreamHost.
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cards (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(80) NOT NULL,
  network ENUM('Visa','Mastercard','American Express','Discover','Diners Club','JCB','UnionPay','Other') NOT NULL,
  issuer VARCHAR(50) NOT NULL DEFAULT 'Other',
  credit_limit DECIMAL(12,2) NOT NULL,
  due_day TINYINT UNSIGNED NOT NULL,
  statement_day TINYINT UNSIGNED NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#244c42',
  position INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cards_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT cards_credit_limit_check CHECK (credit_limit > 0),
  CONSTRAINT cards_due_day_check CHECK (due_day BETWEEN 1 AND 31),
  CONSTRAINT cards_statement_day_check CHECK (statement_day BETWEEN 1 AND 31),
  INDEX cards_user_position (user_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  card_id BIGINT UNSIGNED NOT NULL,
  merchant VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  occurred_on DATE NOT NULL,
  note VARCHAR(240) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT transactions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT transactions_card_fk FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT transactions_amount_check CHECK (amount > 0),
  INDEX transactions_user_date (user_id, occurred_on),
  INDEX transactions_card_date (card_id, occurred_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY categories_user_name (user_id, name),
  CONSTRAINT categories_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
