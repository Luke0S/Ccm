# Slate credit manager — DreamHost + MySQL deployment

Slate runs entirely on your DreamHost hosting account: PHP handles logins and MySQL stores each user’s data. It does not use Supabase or any external database service.

## 1. Create the site in DreamHost

1. In DreamHost, go to **Websites → Manage Websites → Add Hosting to a Domain / Subdomain**.
2. Add `credit.lukesters.com`, select your DreamHost user, and choose fully hosted web hosting.
3. DreamHost shows the web directory it creates; write it down. This is your public site directory.
4. In **Websites → Secure Hosting**, create a Let’s Encrypt certificate for `credit.lukesters.com`. Wait until HTTPS is active.

## 2. Create the MySQL database

1. In DreamHost, go to **More → MySQL Databases** and select **Add New Database**.
2. Create a database, a database user, and a strong password. Associate that user with the database. DreamHost will show the MySQL hostname; it is usually not `localhost`.
3. Open DreamHost **phpMyAdmin** for this database.
4. Open [`database/schema.sql`](database/schema.sql) from this repository, paste all of it into phpMyAdmin’s **SQL** tab, and click **Go**.

This creates `users`, `cards`, and `transactions`. Each card and transaction is linked to one local website user by a foreign key.

## 3. Create the private PHP database configuration

Copy `config.example.php` to `config.php` and fill in the DreamHost database values:

```php
<?php
return [
    'db_host' => 'mysql.your-dreamhost-hostname.com',
    'db_name' => 'your_database_name',
    'db_user' => 'your_database_user',
    'db_password' => 'your_database_password',
];
```

**Recommended:** Put `config.php` one directory above the public website folder, for example `/home/your-user/config.php`. The API checks that location first. This prevents the file from ever being downloadable through the website. If you cannot do that, put it alongside `api.php`; PHP still executes it rather than serving it as text.

Do not commit `config.php`; it is already ignored by Git.

## 4. Upload the application

Using DreamHost SFTP, upload these items into the public web directory created for `credit.lukesters.com`:

```text
.htaccess
index.html
api.php
src/
```

Upload `config.php` **one directory above** that public web directory where possible. Upload it inside the public directory only if DreamHost’s account layout prevents the recommended placement.

You do not need to upload `.git/`, `README.md`, `database/`, `config.example.php`, or `package.json`.

## 5. Test the live site

1. Visit `https://credit.lukesters.com` and verify the browser lock icon.
2. Select **Create an account instead**, enter an email and password with eight or more characters, and submit.
3. Add a card and a transaction.
4. Sign out and sign back in. The card and transaction should remain.
5. Make a second account and verify it cannot see the first account’s data.

## Security model

- Passwords are stored only as PHP `password_hash` values; plaintext passwords are never stored.
- Login sessions use HTTP-only, same-site cookies and regenerate their ID after sign-up or login.
- Every database read and write uses the signed-in session’s local user ID. Card ownership is verified before a transaction is added.
- `.htaccess` disables directory indexing, adds basic response headers, and avoids caching the runtime configuration.

## Local development

This requires PHP and access to the same MySQL database:

```bash
cp config.example.php config.php
# edit config.php with database credentials
php -S localhost:4173
```

Open `http://localhost:4173`.
