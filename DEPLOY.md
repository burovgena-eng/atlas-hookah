# 🚀 Деплой Atlas Hookah на Vercel

## Шаг 1: Создание базы данных PostgreSQL

### Вариант A: Supabase (Рекомендуется)

1. Перейдите на https://supabase.com
2. Нажмите **"Start your project"**
3. Создайте аккаунт или войдите через GitHub
4. Создайте новую организацию (если нужно)
5. Создайте новый проект:
   - **Name:** `atlas-hookah`
   - **Database Password:** сохраните пароль!
   - **Region:** выберите ближайший (например, Frankfurt)
6. Дождитесь создания проекта (~2 минуты)
7. Перейдите в **Settings → Database**
8. Скопируйте **Connection string** (URI формат):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
9. Также скопируйте **Connection string (Direct)** для миграций

### Вариант B: Neon

1. Перейдите на https://neon.tech
2. Нажмите **"Sign up"** (через GitHub)
3. Создайте новый проект
4. Скопируйте connection string

---

## Шаг 2: Деплой на Vercel

### 2.1 Подготовка репозитория

```bash
# Инициализация Git (если ещё нет)
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit: Atlas Hookah App"

# Создание репозитория на GitHub
# Затем:
git remote add origin https://github.com/YOUR-USERNAME/atlas-hookah.git
git push -u origin main
```

### 2.2 Деплой на Vercel

1. Перейдите на https://vercel.com
2. Нажмите **"Sign Up"** (через GitHub)
3. Нажмите **"Add New Project"**
4. Выберите ваш репозиторий `atlas-hookah`
5. Настройте проект:
   - **Framework Preset:** Next.js
   - **Root Directory:** ./
   - **Build Command:** `bun run build`
   - **Output Directory:** .next

### 2.3 Добавление переменных окружения

В Vercel перейдите в **Settings → Environment Variables** и добавьте:

```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?pgbouncer=true&connect_timeout=15

DIRECT_DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres

NEXTAUTH_SECRET=ваш-секретный-ключ-32-символа

NEXTAUTH_URL=https://ваш-домен.vercel.app
```

> 💡 **Генерация NEXTAUTH_SECRET:**
> ```bash
> openssl rand -base64 32
> ```

### 2.4 Деплой

Нажмите **"Deploy"** и дождитесь завершения (~3-5 минут)

---

## Шаг 3: Инициализация базы данных

После первого деплоя нужно применить миграции:

### Вариант A: Через Vercel CLI

```bash
# Установка Vercel CLI
npm i -g vercel

# Логин
vercel login

# Подключение проекта
vercel link

# Применение миграций
vercel env pull .env.local
npx prisma migrate deploy
```

### Вариант B: Через Supabase SQL Editor

1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Скопируйте SQL из `prisma/migrations/*/migration.sql`
4. Выполните SQL

---

## Шаг 4: Создание первого пользователя (Руководителя)

После деплоя создайте первого пользователя через API:

```bash
# Замените YOUR-VERCEL-APP на ваш домен
curl -X POST https://YOUR-VERCEL-APP.vercel.app/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@atlas.com",
    "password": "secure-password-123",
    "name": "Администратор",
    "role": "MANAGER",
    "userId": "first-setup"
  }'
```

Или создайте SQL-запрос в Supabase:

```sql
-- Вставьте хеш пароля (сгенерируйте через bcrypt)
INSERT INTO "User" (id, email, password, name, role, "isApproved")
VALUES (
  'manager-001',
  'manager@atlas.com',
  '$2a$10$hash...', -- нужен реальный хеш
  'Администратор',
  'MANAGER',
  true
);
```

---

## 📋 Чек-лист перед деплоем

- [ ] База данных PostgreSQL создана (Supabase/Neon)
- [ ] Репозиторий на GitHub создан
- [ ] Код загружен в репозиторий
- [ ] Проект на Vercel создан
- [ ] Переменные окружения добавлены:
  - [ ] `DATABASE_URL`
  - [ ] `DIRECT_DATABASE_URL`
  - [ ] `NEXTAUTH_SECRET`
  - [ ] `NEXTAUTH_URL`
- [ ] Первый деплой успешен
- [ ] Миграции применены
- [ ] Первый пользователь-руководитель создан

---

## 🔧 Полезные команды

```bash
# Локальная разработка с PostgreSQL
bun run dev

# Просмотр базы данных
bun run db:studio

# Создание миграции
bun run db:migrate

# Применение миграций на проде
bun run db:migrate:deploy

# Просмотр логов Vercel
vercel logs
```

---

## ❓ Возможные проблемы

### Ошибка "Prisma Client could not be found"
```bash
# Добавьте в build script:
prisma generate && next build
```

### Ошибка "Database connection failed"
- Проверьте правильность DATABASE_URL
- Убедитесь, что IP Vercel разрешён в Supabase (обычно автоматически)

### Ошибка "Authentication failed"
- Проверьте NEXTAUTH_SECRET и NEXTAUTH_URL
- NEXTAUTH_URL должен совпадать с доменом Vercel

---

## 📞 Поддержка

Если возникли вопросы:
1. Проверьте логи в Vercel Dashboard
2. Проверьте переменные окружения
3. Убедитесь, что миграции применены
