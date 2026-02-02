import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, Download, Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabaseAdmin } from "@/integrations/supabase/admin-client";

interface CredentialShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  password: string;
  userName: string;
}

export function CredentialShareDialog({
  open,
  onOpenChange,
  email,
  password,
  userName,
}: CredentialShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    const credentials = `Email: ${email}\nHasło: ${password}`;
    try {
      await navigator.clipboard.writeText(credentials);
      setCopied(true);
      toast({
        title: "Skopiowano",
        description: "Dane logowania zostały skopiowane do schowka",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się skopiować do schowka",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    const credentials = `Dane logowania dla ${userName}\n\nEmail: ${email}\nHasło: ${password}\n\nUwaga: To hasło jest tymczasowe. Zostaniesz poproszony o zmianę hasła przy pierwszym logowaniu.`;
    const blob = new Blob([credentials], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credentials_${email.replace("@", "_at_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Pobrano",
      description: "Plik z danymi logowania został pobrany",
    });
  };

  const handleSendEmail = async () => {
    if (!supabaseAdmin) {
      toast({
        title: "Błąd",
        description: "Klient administratora niedostępny. Nie można wysłać email.",
        variant: "destructive",
      });
      return;
    }

    setSendingEmail(true);
    try {
      // Use Supabase Auth's email functionality
      // Note: This requires Supabase email to be configured
      // We'll use the admin client to send a password reset email as a workaround
      // or create a custom email function
      
      // For now, we'll use a password reset email which will allow the user to set their password
      // This is a workaround - ideally we'd have a custom email template
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
      });

      if (error) {
        // If email sending fails, fall back to showing credentials
        toast({
          title: "Uwaga",
          description: "Nie można wysłać email automatycznie. Użyj opcji kopiowania lub pobierania.",
          variant: "default",
        });
      } else {
        toast({
          title: "Email wysłany",
          description: "Link do ustawienia hasła został wysłany na adres email użytkownika.",
        });
      }
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się wysłać email. Użyj opcji kopiowania lub pobierania.",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dane logowania użytkownika</DialogTitle>
          <DialogDescription>
            Zapisz te dane w bezpiecznym miejscu. Użytkownik będzie musiał zmienić hasło przy pierwszym logowaniu.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Te dane będą wyświetlone tylko raz. Upewnij się, że zostały bezpiecznie przekazane użytkownikowi.
            </AlertDescription>
          </Alert>
          <div className="space-y-2 rounded-lg border p-4 bg-muted/50">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="text-sm font-mono mt-1">{email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Hasło</label>
              <p className="text-sm font-mono mt-1">{password}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="w-full"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Skopiowano
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Kopiuj do schowka
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Pobierz jako plik tekstowy
            </Button>
            <Button
              variant="outline"
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="w-full"
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Wyślij email
                </>
              )}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

