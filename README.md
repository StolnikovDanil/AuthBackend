# AuthBackend

Backend-сервис аутентификации и управления пользователями на Express + TypeScript + Prisma + PostgreSQL. JWT access/refresh токены, ролевая модель (USER/ADMIN), rate limiting, валидация через Zod.

## Стек

- **Runtime:** Node.js, TypeScript (ESM)
- **Фреймворк:** Express 5
- **БД:** PostgreSQL + Prisma ORM (adapter-pg)
- **Аутентификация:** JWT (access + refresh токены), bcrypt для хэширования паролей
- **Валидация:** Zod
- **Логирование:** Pino / pino-http
- **Тесты:** Vitest
- **Прочее:** Helmet, CORS, cookie-parser, express-rate-limit

## Требования

- Node.js 20+
- PostgreSQL (локально или через Docker)
- npm

## Установка

```bash
npm install
```

## Переменные окружения

Создайте файл `.env` в корне проекта:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mybackend?schema=public"
JWT_ACCESS_SECRET="замените-на-длинную-случайную-строку"
JWT_REFRESH_SECRET="замените-на-другую-длинную-случайную-строку"
PORT=5000
FRONTEND_URL=http://localhost:5173
```

| Переменная | Обязательна | Описание |
|---|---|---|
| `DATABASE_URL` | да | Строка подключения к PostgreSQL |
| `JWT_ACCESS_SECRET` | да | Секрет для подписи access-токенов |
| `JWT_REFRESH_SECRET` | да | Секрет для подписи refresh-токенов |
| `PORT` | нет (по умолчанию `3000`) | Порт сервера |
| `FRONTEND_URL` | нет (по умолчанию `http://localhost:5173`) | Разрешённый origin для CORS (через запятую, если несколько) |

## База данных

Поднять PostgreSQL через Docker:

```bash
docker compose up -d postgres
```

Применить миграции и сгенерировать Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
```

Открыть Prisma Studio (просмотр/редактирование данных через UI):

```bash
npx prisma studio
```

## Запуск

Режим разработки (с автоперезапуском):

```bash
npm run dev
```

Сборка и запуск production-версии:

```bash
npm run build
npm start
```

Запуск через Docker Compose (поднимет БД и приложение вместе):

```bash
docker compose up --build
```

## Тесты

```bash
npm test          # разовый прогон
npm run test:watch    # watch-режим
npm run test:coverage # с покрытием
```

## API

Базовый URL по умолчанию: `http://localhost:5000`

### Auth (`/auth`)

Все эндпоинты ниже ограничены rate-limit'ом (10 запросов / 15 минут с одного IP).

| Метод | Путь | Описание | Тело запроса |
|---|---|---|---|
| POST | `/auth/register` | Регистрация нового пользователя (роль всегда `USER`) | `{ email, password, name? }` |
| POST | `/auth/login` | Логин, выдаёт `accessToken` в ответе и `refreshToken` в httpOnly cookie | `{ email, password }` |
| POST | `/auth/refresh` | Обновление пары токенов по refresh-cookie | — (refresh-токен берётся из cookie) |
| POST | `/auth/logout` | Инвалидация refresh-токена | — |

### Users (`/users`)

Требуют заголовок `Authorization: Bearer <accessToken>`.

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| GET | `/users` | только `ADMIN` | Список всех пользователей |
| PUT | `/users/:id` | сам пользователь или `ADMIN` | Обновление `name`/`email` |
| DELETE | `/users/:id` | только `ADMIN` | Удаление пользователя |

Ответы по пользователю никогда не содержат поле `password`.

## Структура проекта

```
src/
  controllers/   # обработчики запросов
  services/      # бизнес-логика, работа с Prisma
  middlewares/   # auth, роли, валидация, обработка ошибок
  routes/        # регистрация маршрутов
  schemas/       # Zod-схемы валидации
  types/         # расширения типов Express
  constants/     # конфигурационные константы
  utils/         # логгер и т.п.
prisma/
  schema.prisma  # модели User, RefreshToken
  migrations/    # история миграций БД
```

## Роли

- `USER` — назначается по умолчанию при регистрации.
- `ADMIN` — назначается вручную (через Prisma Studio или SQL), эндпоинта для повышения роли через API нет.

## Лицензия

ISC