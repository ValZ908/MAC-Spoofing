import {
  listAdapterLocks,
  listGatewayLocks,
  listMacRotationLog,
} from "@/lib/db/queries";
import { IdentityClient } from "./identity-client";

export default async function IdentityPage() {
  // Adapter list and gateway info are fetched client-side (PowerShell cold
  // start is slow, and gateway detection needs a fresh route lookup).
  return (
    <IdentityClient
      initialLog={listMacRotationLog(20)}
      initialLocks={listAdapterLocks()}
      initialGatewayLocks={listGatewayLocks()}
    />
  );
}
