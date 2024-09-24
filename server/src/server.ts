import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { PubSub } from "graphql-subscriptions";
import { createServer } from "http";
import express from "express";
import { SubscriptionServer } from "subscriptions-transport-ws";
import { execute, subscribe } from "graphql";
import { WebSocketServer } from "ws";
import bodyParser from "body-parser";
import cors from "cors";

//The GraphQL Schema
const typeDefs = `
    type Message {
        id: ID!
        content: String!
    }

    type Query {
        messages: [Message!]
        message(id: ID!): MEssage
    }

    type Mutation {
        addMessage( content: String!): Message
        updateMessage(id: ID!, content: String!): Message
        deleteMEssage(id: ID!): Message
    }

    type Subscription {
    messageAdded: Message
    messageUpdated: Message
    messageDeleted: Message
    }
    `;

//In-memory message storage
const messages: Array<{ id: string, content: string}> =[];
const pubsub = new PubSub();

//Define resolvers for handling GraphQL operations
const resolvers ={
    Query: {
        messages: () => messages,
        message: (parent, { id }) => messages.find(message => message.id === id),
    },
    Mutation: {
        addMessage: (parent, { content }) => {
            const message ={ id: `${messages.length + 1}`, content };
            messages.push(message);
            pubsub.publish('MESSAGE_ADDED', {messageAdded: message });
            return message;
        },
        updateMessage: (parent, {id , content }) => {
            const message = messages.find(message => message.id === id);
            if (!message) throw new Error('Message not found');
            message.content = content;
            pubsub.publish('MESSAGE_UPDATED', { messageUpdated: message });
            return message;
        },
        deleteMessage: (parent, { id }) => {
            const index = messages.findIndex(message => message.id === id );
            if (index === -1) throw new Error('Message not found');
            const [message] = messages.splice(index, 1);
            pubsub.publish('MESSAGE_DELETED', { messageDeleted: message });
            return message;
        },
    },
    Subscription: {
        messageAdded: {
            subscribe: () => pubsub.asyncIterator(['MESSAGE_ADDED']),
        },
        messageUpdated: {
            subscribe: () => pubsub.asyncIterator(['MESSAGE_UPDATED']),
        },
        messageDeleted: {
            subscribe: () => pubsub.asyncIterator(['MESSAGE_DELETED']),
        },
    },
};

//Create the executable schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express(); // Created express application
const httpServer = createServer(app); // Created an HTTP server

//Set up WebSocket server for subscriptions
const wsServer = new WebSocketServer({
    server:httpServer,
    path: '/graphql',
});

//Createed the subscription server
const subscriptionServer = SubscriptionServer.create(
    {
        schema,
        execute,
        subscribe,
        onConnect: () => console.log('Connected to websocket'),
    },
    wsServer
);

// Created ApolloServer instance with schema and plugins
const server = new ApolloServer({
    schema,
    plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        {
            async serverWillStart() {
                return {
                    async drainServer() {
                        subscriptionServer.close();
                    },
                };
            },
        },
    ],
});

//Start the server and set up middleware
server.start().then(() => {
    app.use(cors()); //Enable CORS
    app.use(bodyParser.json()); //Parse JSON request bodies
    app.use('/graphql', expressMiddleware(server)); //Add Apollo middleware to Express
    httpServer.listen(400, () => {
        console.log('Server is running on http://localhost: 4000/graphql'); //start the server
    });
});