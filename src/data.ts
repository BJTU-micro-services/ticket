export enum TicketState {
  InStock = "in stock",
  Ordered = "ordered",
  Purchased = "purchased",
}

export interface Ticket {
  id: number;
  name: string;
  state: TicketState;
  user_id: number | null;
}
