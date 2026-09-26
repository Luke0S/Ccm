<?php
declare(strict_types=1);

$configPath = __DIR__ . '/../config.php';
if (!file_exists($configPath)) $configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) respond(['error' => 'Server configuration is missing.'], 500);
$config = require $configPath;
session_name('slate_session');
session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax']);
session_start();

try {
    $db = new PDO("mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4", $config['db_user'], $config['db_password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $_GET['action'] ?? '';
    if ($action === 'signup') signup($db, $input);
    if ($action === 'login') login($db, $input);
    if ($action === 'logout') { session_destroy(); respond(['ok' => true]); }
    if ($action === 'me') respond(['user' => currentUser()]);
    $user = requireUser();
    if ($action === 'data') data($db, $user['id']);
    if ($action === 'card') addCard($db, $user['id'], $input);
    if ($action === 'transaction') addTransaction($db, $user['id'], $input);
    if ($action === 'reorder') reorder($db, $user['id'], $input);
    respond(['error' => 'Unknown request.'], 404);
} catch (PDOException $error) { error_log($error->getMessage()); respond(['error' => 'Database request failed.'], 500); }

function respond(array $body, int $status = 200): never { http_response_code($status); header('Content-Type: application/json'); header('Cache-Control: no-store'); echo json_encode($body); exit; }
function currentUser(): ?array { return isset($_SESSION['user']) ? $_SESSION['user'] : null; }
function requireUser(): array { $user = currentUser(); if (!$user) respond(['error' => 'Please sign in first.'], 401); return $user; }
function field(array $data, string $key, int $max = 255): string { $value = trim((string)($data[$key] ?? '')); if ($value === '' || mb_strlen($value) > $max) respond(['error' => "Invalid {$key}."], 422); return $value; }
function signup(PDO $db, array $input): never { $email = filter_var(strtolower(field($input, 'email', 254)), FILTER_VALIDATE_EMAIL); $password = (string)($input['password'] ?? ''); if (!$email || strlen($password) < 8) respond(['error' => 'Use a valid email and a password of at least 8 characters.'], 422); $check = $db->prepare('SELECT id FROM users WHERE email = ?'); $check->execute([$email]); if ($check->fetch()) respond(['error' => 'An account with that email already exists.'], 409); $db->prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')->execute([$email, password_hash($password, PASSWORD_DEFAULT)]); session_regenerate_id(true); $_SESSION['user'] = ['id' => (int)$db->lastInsertId(), 'email' => $email]; respond(['user' => $_SESSION['user']], 201); }
function login(PDO $db, array $input): never { $email = filter_var(strtolower(field($input, 'email', 254)), FILTER_VALIDATE_EMAIL); $password = (string)($input['password'] ?? ''); $query = $db->prepare('SELECT id, email, password_hash FROM users WHERE email = ?'); $query->execute([$email]); $row = $query->fetch(); if (!$row || !password_verify($password, $row['password_hash'])) respond(['error' => 'Incorrect email or password.'], 401); session_regenerate_id(true); $_SESSION['user'] = ['id' => (int)$row['id'], 'email' => $row['email']]; respond(['user' => $_SESSION['user']]); }
function data(PDO $db, int $id): never { $cards = $db->prepare('SELECT * FROM cards WHERE user_id = ? ORDER BY position, created_at'); $cards->execute([$id]); $transactions = $db->prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY occurred_on DESC, created_at DESC'); $transactions->execute([$id]); respond(['cards' => $cards->fetchAll(), 'transactions' => $transactions->fetchAll()]); }
function addCard(PDO $db, int $userId, array $input): never { $name = field($input, 'name', 80); $network = field($input, 'network', 30); $validNetworks = ['Visa','Mastercard','American Express','Discover','Other']; if (!in_array($network, $validNetworks, true)) respond(['error' => 'Invalid card network.'], 422); $limit = filter_var($input['credit_limit'] ?? null, FILTER_VALIDATE_FLOAT); $due = filter_var($input['due_day'] ?? null, FILTER_VALIDATE_INT); $statement = filter_var($input['statement_day'] ?? null, FILTER_VALIDATE_INT); if (!$limit || $limit <= 0 || !$due || $due > 31 || !$statement || $statement > 31) respond(['error' => 'Enter a valid card limit and calendar days.'], 422); $position = (int)$db->query("SELECT COUNT(*) FROM cards WHERE user_id = {$userId}")->fetchColumn(); $colors = ['#244c42','#c99044','#bf6251','#506f9a','#655a8f']; $db->prepare('INSERT INTO cards (user_id,name,network,credit_limit,due_day,statement_day,color,position) VALUES (?,?,?,?,?,?,?,?)')->execute([$userId,$name,$network,$limit,$due,$statement,$colors[$position % count($colors)],$position]); respond(['ok' => true], 201); }
function addTransaction(PDO $db, int $userId, array $input): never { $cardId = filter_var($input['card_id'] ?? null, FILTER_VALIDATE_INT); $merchant = field($input, 'merchant', 120); $amount = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT); $category = field($input, 'category', 50); $date = field($input, 'occurred_on', 10); $note = trim((string)($input['note'] ?? '')); if (!$cardId || !$amount || $amount <= 0 || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || mb_strlen($note) > 240) respond(['error' => 'Invalid transaction details.'], 422); $card = $db->prepare('SELECT id FROM cards WHERE id = ? AND user_id = ?'); $card->execute([$cardId,$userId]); if (!$card->fetch()) respond(['error' => 'Card not found.'], 404); $db->prepare('INSERT INTO transactions (user_id,card_id,merchant,amount,category,occurred_on,note) VALUES (?,?,?,?,?,?,?)')->execute([$userId,$cardId,$merchant,$amount,$category,$date,$note ?: null]); respond(['ok' => true], 201); }
function reorder(PDO $db, int $userId, array $input): never { $ids = $input['ids'] ?? []; if (!is_array($ids)) respond(['error' => 'Invalid card order.'], 422); $db->beginTransaction(); $update = $db->prepare('UPDATE cards SET position = ? WHERE id = ? AND user_id = ?'); foreach ($ids as $position => $id) $update->execute([$position, (int)$id, $userId]); $db->commit(); respond(['ok' => true]); }
