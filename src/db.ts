import redis from "redis";
import { Ticket, TicketState } from "./data";

const redisClient = redis.createClient();

redisClient.on("error", (error) => console.error(error));

const tickets: Ticket[] = [
  { id: 0, name: "ticket_0", state: TicketState.InStock, user_id: null },
  { id: 1, name: "ticket_1", state: TicketState.InStock, user_id: null },
  { id: 2, name: "ticket_2", state: TicketState.InStock, user_id: null },
  { id: 3, name: "ticket_3", state: TicketState.InStock, user_id: null },
  { id: 4, name: "ticket_4", state: TicketState.InStock, user_id: null },
];

redisClient.set("tickets", JSON.stringify(tickets));

export default redisClient;
