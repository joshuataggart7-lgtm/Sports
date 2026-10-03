/**
 * Every integration in Room OS carries one of these labels, and the UI shows it.
 * Nothing is ever presented as working hardware unless it reported CONNECTED itself.
 */
export type IntegrationStatus = "CONNECTED" | "SIMULATED" | "UNVERIFIED" | "OFFLINE";
