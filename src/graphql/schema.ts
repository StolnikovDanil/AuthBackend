export const typeDefs =  `
  enum NotificationType {
    NEW_DEVICE_LOGIN
  }

  type Notification {
    id: Int!
    type: NotificationType!
    message: String!
    read: Boolean!
    createdAt: String!
  }

  type Query {
    notifications: [Notification!]!
  }

  type Mutation {
    markNotificationRead(id: Int!): Notification!
  }

  type Subscription {
    notificationAdded: Notification!
  }
`;