import { Room, Client, generateId } from "colyseus";
import { Schema, MapSchema, ArraySchema, Context } from "@colyseus/schema";
import { verifyToken, User, IUser } from "@colyseus/social";

// Create a context for this room's state data.
const type = Context.create();

class Player extends Schema {
  @type("boolean") connected: boolean = true;
  @type("number") noUrut: number = 0;
  @type("string") idGS: string = "";

  @type(["uint8"])
  cardsHand = new ArraySchema<number>();
  
  @type(["uint8"])
  cardsTong = new ArraySchema<number>();

  @type(["uint8"])
  cardsGeseran = new ArraySchema<number>();

  @type("int8") poinBesar: number = 0;
  @type("int8") pinKecil: number = 0;
  @type("boolean") hasPulled: boolean = false;

  @type("string") nextPlayerId: string = "";
  @type("string") prevPlayerId: string = "";

  @type(["uint8"]) setMata = new ArraySchema();
  @type(["uint8"]) setKaki = new ArraySchema();
  @type(["uint8"]) setKoa = new ArraySchema();
  
  @type("boolean") isKoa: boolean = false;
}

class State extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();

  @type(["uint8"])
  cardStack = new ArraySchema<number>();
}

/**
 * Demonstrate sending schema data types as messages
 */
class Message extends Schema {
  @type("boolean") hasError = false;
}

export class KoaBaliRoom extends Room {

  maxClients = 20;

  onCreate (options: any) {
    console.log("KoaBaliRoom created.", options);

    this.setState(new State());

    this.setMetadata({
      str: "hello",
      number: 10
    });

    this.setPatchRate(1000 / 20);
    this.setSimulationInterval((dt) => this.update(dt));

    this.onMessage(0, (client, message) => {
      client.send(0, message);
    });

    this.onMessage("schema", (client) => {
      const message = new Message();
      client.send(message);
    });

    this.onMessage("setInitData", (client, message) => {
      this.state.players[client.sessionId].noUrut = message.noUrut;
      this.state.players[client.sessionId].idGS = message.idGS;

      
      const newMessage = new Message();
      // jika dari client mengirimkan jumlah pemain yg berbeda satu dg yg lain maka muncul error.
      if(this.maxClients === 20){
        this.maxClients = message.maxClients;
      }
      if(this.maxClients !== message.maxClients){
        this.maxClients = message.maxClients;
        newMessage.hasError = true; 
      }

      // tentukan nextPlayerId dan prevPlayerId pada semua pemain
      if(this.maxClients === this.state.players.size){
        this.state.players.forEach((value, key) => {
          this.state.players.forEach((value2, key2) => {
          if(value.noUrut + 1 === value2.noUrut || (value.noUrut === this.maxClients - 1 && value2.noUrut === 0)){
            value.nextPlayerId = key2;
          }
          else if(value.noUrut - 1 === value2.noUrut ||(value.noUrut === 0 && value2.noUrut === this.maxClients)){
            value.prevPlayerId = key2;
          }
          });
        });
      }

      client.send(newMessage);

      console.log(`received message setInitData from ${client.sessionId}:`, message);
    });

    this.onMessage("move_right", (client) => {
      this.broadcast("hello", { hello: "hello world" });
    });

    this.onMessage("*", (client, type, message) => {
      console.log(`received message "${type}" from ${client.sessionId}:`, message);
    });
  }

  async onAuth (client, options) {
    console.log("onAuth(), options!", options);
    return await User.findById(verifyToken(options.token)._id);
  }

  onJoin (client: Client, options: any, user: IUser) {
    console.log("client joined!", client.sessionId);
    this.state.players[client.sessionId] = new Player();
    client.send("type", { hello: true });
    client.send("joinSuccess");
  }

  async onLeave (client: Client, consented: boolean) {
    this.state.players[client.sessionId].connected = false;

    try {
      if (consented) {
        throw new Error("consented leave!");
      }

      console.log("let's wait for reconnection!")
      const newClient = await this.allowReconnection(client, 10);
      console.log("reconnected!", newClient.sessionId);

    } catch (e) {
      console.log("disconnected!", client.sessionId);
      delete this.state.players[client.sessionId];
    }
  }


  update (dt?: number) {
    // console.log("num clients:", Object.keys(this.clients).length);
  }

  onDispose () {
    console.log("KoaBaliRoom disposed.");
  }

}
