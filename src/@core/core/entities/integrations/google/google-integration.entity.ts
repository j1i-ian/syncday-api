import { Entity } from "typeorm";
import { Integration } from "../integration.entity";

@Entity()
export class GoogleIntegration extends Integration {}
