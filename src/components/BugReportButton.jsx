import { useState } from "react";
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
} from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";

const TICKET_ENDPOINT =
  "https://ecommerce-backend-wpzvfp2i7q-ey.a.run.app/graphql/gengar_games/";

const MUTATION = `
  mutation CreateDevTicket(
    $ticketType: String!
    $description: String!
    $pageUrl: String
    $surface: String
    $userAgent: String
    $viewport: String
  ) {
    createDevTicket(
      ticketType: $ticketType
      description: $description
      pageUrl: $pageUrl
      surface: $surface
      userAgent: $userAgent
      viewport: $viewport
    ) {
      ticket { id }
    }
  }
`;

export default function BugReportButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    const description = text.trim();
    if (description.length < 8) {
      setError("Say what went wrong in a sentence or two.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const electron = window.require?.("electron");
      if (electron?.ipcRenderer) {
        await electron.ipcRenderer.invoke("submit-dev-ticket", description);
        setText("");
        setOpen(false);
        return;
      }
      const response = await fetch(TICKET_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: MUTATION,
          variables: {
            ticketType: "bug",
            description: `Pudo booking app: ${description}`,
            pageUrl: window.location.href,
            surface: "storefront",
            userAgent: navigator.userAgent,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          },
        }),
      });
      const body = await response.json();
      const message = body?.errors?.[0]?.message;
      if (!response.ok || message || !body?.data?.createDevTicket?.ticket?.id) {
        throw new Error(message || "Could not send the report.");
      }
      setText("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the report.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Fab
        color="primary"
        aria-label="Report a bug"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        sx={{
          position: "fixed",
          right: 16,
          bottom: { xs: "calc(72px + env(safe-area-inset-bottom))", md: 24 },
          zIndex: (theme) => theme.zIndex.appBar + 1,
        }}
      >
        <BugReportIcon />
      </Fab>
      <Dialog open={open} onClose={() => !sending && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Report a bug</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="What went wrong?"
            placeholder="Which screen, and what you expected to happen"
            fullWidth
            multiline
            minRows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={sending}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submit} disabled={sending}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
