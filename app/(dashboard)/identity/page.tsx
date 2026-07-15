import {
  listAdapterLocks,
  listMacRotationLog,
} from "@/lib/db/queries";
import { IdentityClient } from "./identity-client";

export default async function IdentityPage() {
  // Adapter list is fetched client-side (PowerShell cold start is slow).
  return (
    <IdentityClient
      initialLog={listMacRotationLog(20)}
      initialLocks={listAdapterLocks()}
    />
  );
}
