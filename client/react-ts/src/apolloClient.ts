import { ApolloClient, InMemoryCache, ApolloProvider, split, HttpLink } from '@apollo/client';
import { WebSocketLink } from '@apollo/client/link/ws';
import { getMainDefinition } from '@apollo/client/utilities';

// HTTP link to connect to the GraphQL server via HTTP
const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

// WebSocket link to connect to the GraphQL server via WebSocket
const wsLink = new WebSocketLink({
  uri: 'ws://localhost:4000/graphql',
  options: {
    reconnect: true, 
  },
});

// Split the link based on operation type
const splitLink = split(
  ({ query }) => {
    // Extract the main definition from the query
    const definition = getMainDefinition(query);
    // Check if the operation is a subscription
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink, // Use WebSocket link for subscriptions
  httpLink // Use HTTP link for queries and mutations
);

// Apollo Client instance
const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

// Export the Apollo Client and Apollo Provider for use in the React application
export { client, ApolloProvider };