# AuthBackend

Backend-сервис аутентификации и управления пользователями на Express + TypeScript + Prisma + PostgreSQL. JWT access/refresh токены, ролевая модель (USER/ADMIN), rate limiting, валидация через Zod, AI-аналитика попыток входа через Gemini API. Уведомления о входах с новых устройств доступны через GraphQL (запросы, мутации и live-подписки).

## Стек

- **Runtime:** Node.js, TypeScript (ESM)
- **Фреймворк:** Express 5
- **API:** REST + GraphQL (`graphql-yoga`) — оба смонтированы на одном Express-приложении
- **БД:** PostgreSQL + Prisma ORM (adapter-pg)
- **Кэш/сессии:** Redis (ioredis) — хранение refresh-токенов
- **Realtime:** Socket.IO — live-события rate-limit'а поверх того же HTTP-сервера
- **Аутентификация:** JWT (access + refresh токены), bcrypt для хэширования паролей
- **Валидация:** Zod
- **Логирование:** Pino / pino-http
- **AI:** Google Gemini API (`gemini-2.5-flash-lite`) — саммари и риск-флаги по попыткам входа
- **Тесты:** Vitest, Supertest
- **Прочее:** Helmet, CORS, cookie-parser, express-rate-limit

## Требования

- Node.js 20+
- PostgreSQL (локально или через Docker)
- Redis (локально или через Docker)
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
GEMINI_API_KEY="ваш-ключ-из-Google-AI-Studio"
REDIS_PASSWORD="замените-на-пароль-redis"
REDIS_URL="redis://:замените-на-пароль-redis@localhost:6379"
```

| Переменная | Обязательна | Описание |
|---|---|---|
| `DATABASE_URL` | да | Строка подключения к PostgreSQL |
| `JWT_ACCESS_SECRET` | да | Секрет для подписи access-токенов |
| `JWT_REFRESH_SECRET` | да | Секрет для подписи refresh-токенов |
| `REDIS_URL` | да | Строка подключения к Redis (хранение refresh-токенов) — без неё сервер не стартует |
| `REDIS_PASSWORD` | да (для `docker-compose`) | Пароль Redis, подставляется в `REDIS_URL` и в healthcheck контейнера |
| `PORT` | нет (по умолчанию `3000`) | Порт сервера |
| `FRONTEND_URL` | нет (по умолчанию `http://localhost:5173`) | Разрешённый origin для CORS и Socket.IO (через запятую, если несколько) |
| `GEMINI_API_KEY` | нет* | Ключ Gemini API (бесплатный тир, [aistudio.google.com](https://aistudio.google.com/apikey)). Без него `/admin/insights` продолжает отдавать статистику, но без AI-саммари |

\* Не обязательна для старта сервера — читается лениво, только при вызове `/admin/insights`.

## База данных и Redis

Поднять PostgreSQL и Redis через Docker:

```bash
docker compose up -d postgres redis
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

Все эндпоинты ниже ограничены rate-limit'ом (10 запросов / 15 минут с одного IP). Каждая попытка входа (успешная и неуспешная) записывается в таблицу `login_attempts` для последующей аналитики.

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

### AI-Insights (`/admin/insights`)

Только `ADMIN`. Ограничен отдельным rate-limit'ом (10 запросов / час с одного IP) — чтобы не исчерпать бесплатный дневной лимит Gemini API.

| Метод | Путь | Доступ | Query-параметры | Описание |
|---|---|---|---|---|
| GET | `/admin/insights` | только `ADMIN` | `hours` (число, 1–720, по умолчанию `24`) | Агрегированная статистика попыток входа за период + AI-саммари и риск-флаги |

Пример ответа:

```json
{
  "summary": "За последние 24 часа зафиксировано 142 попытки входа, из них 12 неуспешных...",
  "riskFlags": ["Серия из 5 подряд неуспешных попыток на один аккаунт"],
  "rawStats": {
    "periodHours": 24,
    "totalAttempts": 142,
    "successCount": 130,
    "failedCount": 12,
    "uniqueFailedIps": 5,
    "topFailStreaks": [{ "target": "user_42", "consecutiveFailures": 5 }],
    "newDeviceEventsCount": 2,
    "previousPeriod": { "totalAttempts": 98, "changePercent": 45 }
  }
}
```

Если Gemini API недоступен (таймаут, лимит, сеть) — эндпоинт всё равно отдаёт `200` с `rawStats`, но `summary: null` и полем `aiError` с пояснением. Если непонятен запрос (например, `hours` вне диапазона 1–720) — `400` с деталями валидации.

В промпт, который уходит в Gemini, никогда не попадают email, пароли или токены — только агрегированные числа и хеши (см. `src/services/insights.service.ts`).

### GraphQL (`/graphql`)

Отдельная точка входа на том же порту, смонтирована через `graphql-yoga`. Требует тот же `Authorization: Bearer <accessToken>`, что и REST — авторизация читается в `src/graphql/context.ts` и проверяется в резолверах. В браузере `/graphql` отдаёт встроенный GraphiQL для ручных запросов.

Схема целиком — уведомления пользователя о входах с новых устройств:

```graphql
type Notification {
  id: Int!
  type: NotificationType!   # NEW_DEVICE_LOGIN
  message: String!
  read: Boolean!
  createdAt: String!
}

type Query {
  notifications: [Notification!]!             # только свои уведомления
}

type Mutation {
  markNotificationRead(id: Int!): Notification!  # только свои
}

type Subscription {
  notificationAdded: Notification!             # live-события через SSE
}
```

Логика "нового устройства" в `checkNewDevice` (`src/services/notifications.service.ts`) — та же, что уже использовалась в `/admin/insights`: сравнение `ip`/`userAgent` текущего входа с историей успешных `login_attempts` пользователя. Срабатывает на `POST /auth/login` через хук `src/hooks/onNewDeviceLogin.ts`, до записи текущей попытки в историю. Уведомление создаётся в БД и одновременно публикуется в `Subscription.notificationAdded` через общий `PubSub` (`src/graphql/pubsub.ts`), с топиком, привязанным к `userId` — так подписка каждого пользователя видит только свои события.

Без валидного токена любой Query/Mutation/Subscription-запрос возвращает ошибку `extensions.code: "UNAUTHENTICATED"`.

### Socket.IO

Поднимается поверх того же HTTP-сервера в `src/index.ts` (`initSocket`), не требует аутентификации. При подключении клиент автоматически попадает в комнату по своему IP (`rl:<ip>`). Когда любой из rate-limit'ов (`register`, `login`, `refresh`, `insights`) срабатывает для этого IP, всем сокетам в его комнате рассылается событие:

```ts
socket.on('rateLimited', (payload: { limiter: string; resetAt: string; retryAfterMs: number }) => {
  // ...
});
```

Используется, чтобы фронтенд мог показать обратный отсчёт до снятия ограничения, не опрашивая REST повторными запросами.

## Структура проекта

```
redis.ts         # инициализация ioredis-клиента
src/
  app.ts         # конфигурация Express-приложения (без запуска сервера)
  index.ts       # точка входа, app.listen, initSocket
  socket.ts      # Socket.IO: комнаты по IP, событие rateLimited
  controllers/   # обработчики REST-запросов
  services/      # бизнес-логика, работа с Prisma, интеграция с Gemini
  hooks/         # побочные эффекты на доменные события (напр. уведомление о новом устройстве при логине)
  graphql/       # GraphQL-слой: schema.ts, resolvers.ts, context.ts, pubsub.ts
  middlewares/   # auth, роли, валидация, обработка ошибок
  routes/        # регистрация REST-маршрутов
  schemas/       # Zod-схемы валидации
  types/         # расширения типов Express
  constants/     # конфигурационные константы, rate-limit'ы
  utils/         # логгер и т.п.
prisma/
  schema.prisma  # модели User, RefreshToken, LoginAttempt, Notification
  migrations/    # история миграций БД
```

## Роли

- `USER` — назначается по умолчанию при регистрации.
- `ADMIN` — назначается вручную (через Prisma Studio или SQL), эндпоинта для повышения роли через API нет.

## Лицензия

ISC