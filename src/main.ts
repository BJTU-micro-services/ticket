import {
  Consumer,
  HighLevelProducer,
  KafkaClient,
  Message,
  ProduceRequest,
} from "kafka-node";
import redisClient from "./db";
import { Ticket, TicketState } from "./data";

const kafkaClient = new KafkaClient();
const consumer = new Consumer(
  kafkaClient,
  [
    { topic: "payment_successful" },
    { topic: "list_tickets" },
    { topic: "order_ticket" },
  ],
  {
    autoCommit: false,
  }
);
consumer.on("error", error => {
  console.error("Consumer error:", error);
})
const producer = new HighLevelProducer(kafkaClient);

consumer.on("message", (message: Message) => {
  if (typeof message.value !== "string") {
    throw new Error("Message type should be 'string'");
  }
  console.log(message);
  try {
    switch (message.topic) {
      case "order_ticket":
        return orderTicket(JSON.parse(message.value));
      case "payment_succesful":
        return paymentSuccesful(JSON.parse(message.value));
      case "list_tickets":
        return listTickets();
      default:
        console.error(`Unexpected topic: ${message.topic}`);
    }
  } catch (e) {
    console.error(e);
  }
});

function sendPayloads(payloads: ProduceRequest[]): void {
  // producer.on("ready", () => {
  producer.send(payloads, (err, data) => {
    console.log(err ? err : data);
  });
  // });
}

function getTickets(): Promise<Ticket[]> {
  return new Promise((resolve, reject) =>
    redisClient.get("tickets", (err, reply) =>
      err ? reject(err) : resolve(JSON.parse(reply))
    )
  );
}

// If ticket can be found and is ordered, set its state to purchased
async function paymentSuccesful(message: { user_id: number; ticket_id: number }) {
  const tickets: Ticket[] = await getTickets();
  const ticket = tickets.find((i) => i.id === message.ticket_id);

  if (
    typeof ticket !== "undefined" &&
    ticket.state === TicketState.Ordered &&
    ticket.user_id === message.user_id
  ) {
    sendPayloads([
      {
        topic: "validate_payment",
        messages: JSON.stringify({ user_id: message.user_id, ticket_id: message.ticket_id }),
      },
    ]);
    ticket.state = TicketState.Purchased;
    redisClient.set("tickets", JSON.stringify(tickets));
  }
}

// Send array of tickets
async function listTickets() {
  console.log("list");
  const tickets: Ticket[] = await getTickets();
  console.log(tickets);
  sendPayloads([{ topic: "ticket", messages: JSON.stringify(tickets) }]);
}

// Send message with ticket_id if ticket can be found or null
async function orderTicket(message: { user_id: number; ticket_id: number }) {
  const tickets: Ticket[] = await getTickets();
  const ticket = tickets.find((i) => i.id === message.ticket_id);
  const timeBeforeExpiry = 1000 * 20;

  if (typeof ticket === "undefined") {
    sendPayloads([
      {
        topic: "order",
        messages: JSON.stringify({ user_id: message.user_id, ticket_id: null }),
      },
    ]);
  } else {
    ticket.state = TicketState.Ordered;
    ticket.user_id = message.user_id;
    redisClient.set("tickets", JSON.stringify(tickets));
    sendPayloads([
      {
        topic: "new_order",
        messages: JSON.stringify({
          user_id: message.user_id,
          ticket_id: ticket.id,
          expiry: new Date().setMilliseconds(new Date().getMilliseconds() + timeBeforeExpiry)
        }),
      },
    ]);

    setTimeout(async () => {
      const tickets: Ticket[] = await getTickets();
      const ticket = tickets.find((i) => i.id === message.ticket_id);

      // Set ticket state back to "in stock" if the ticket was not purchased within 20s
      if (
        typeof ticket !== "undefined" &&
        ticket.state === TicketState.Ordered
      ) {
        ticket.state = TicketState.InStock;
        redisClient.set("tickets", JSON.stringify(tickets));
      }
    }, timeBeforeExpiry);
  }
}
