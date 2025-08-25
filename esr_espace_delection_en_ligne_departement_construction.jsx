import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ShieldCheck, Vote, Send } from "lucide-react";

const ELECTION_CONFIG = {
  org: "ESR — Ensemble sur la Réussite",
  dept: "Département de la Construction",
  races: [
    {
      id: "dg-construction",
      title: "Directeur Général de la Construction",
      candidates: [
        { id: "ndona-joel", name: "Ingénieur Ndona Joël" },
        { id: "toussaint-enock", name: "Ingénieur Toussaint Enock" },
        { id: "parfait-kukambisa", name: "Ingénieur Parfait Kukambisa" },
      ],
      maxChoices: 1,
    },
    {
      id: "rep-etude-conception",
      title: "Représentant du Service Étude & Conception Technique",
      candidates: [
        { id: "achema-tonny", name: "Ingénieur Achema Tonny" },
        { id: "bawota-bibiane", name: "Architecte Bawota Bibiane" },
      ],
      maxChoices: 1,
    },
  ],
  adminPIN: "1234",
  adminWhatsApp: "+243834757010",
};

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ElectionESR() {
  const [voter, setVoter] = useState({ name: "", phone: "", code: "" });
  const [choices, setChoices] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const v = localStorage.getItem("esr_has_voted");
    setHasVoted(!!v);
    const saved = localStorage.getItem("esr_ballot");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setVoter(parsed.voter || { name: "", phone: "", code: "" });
        setChoices(parsed.choices || {});
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("esr_ballot", JSON.stringify({ voter, choices }));
  }, [voter, choices]);

  const validation = useMemo(() => {
    const errors = [];
    ELECTION_CONFIG.races.forEach((race) => {
      const sel = choices[race.id];
      if (!sel) errors.push(`Choisissez un candidat pour « ${race.title} ».`);
    });
    if (!voter.name.trim()) errors.push("Entrez votre nom complet.");
    if (!voter.phone.trim()) errors.push("Entrez votre téléphone (WhatsApp).");
    return { ok: errors.length === 0, errors };
  }, [choices, voter]);

  function submitBallot() {
    if (!validation.ok || hasVoted) return;
    const id = uuid();

    const store = JSON.parse(localStorage.getItem("esr_votes_store") || "[]");
    const alreadyVoted = store.find(v => v.voter.phone === voter.phone);
    if (alreadyVoted) {
      alert("Ce numéro WhatsApp a déjà voté.");
      setHasVoted(true);
      setReceipt(alreadyVoted.id);
      return;
    }

    const record = { id, ts: new Date().toISOString(), voter: { ...voter }, choices, note: note.trim() };
    store.push(record);
    localStorage.setItem("esr_votes_store", JSON.stringify(store));
    localStorage.setItem("esr_has_voted", "yes");
    setHasVoted(true);
    setReceipt(id);

    const msg = `Bonjour Admin ESR,%0AVoici mon vote :%0A` +
      ELECTION_CONFIG.races.map((r) => `- ${r.title} : ${r.candidates.find((c) => c.id === choices[r.id])?.name || ""}`).join("%0A") +
      `%0A%0ANom : ${voter.name}%0ATéléphone : ${voter.phone}%0AReçu : ${id}`;
    window.open(`https://wa.me/${ELECTION_CONFIG.adminWhatsApp}?text=${msg}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <header className="mb-6 text-center">
          {/* Removed external image import to prevent build error */}
          <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <ShieldCheck className="w-5 h-5" />
            <span>Espace d’élection sécurisé — {ELECTION_CONFIG.org}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">{ELECTION_CONFIG.dept}</h1>
          <p className="text-gray-600 mt-1">Vote en ligne pour deux postes — Un seul vote par appareil.</p>
        </header>

        <Tabs defaultValue="voter">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="voter">Voter</TabsTrigger>
            <TabsTrigger value="resultats">Résultats (local)</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="voter">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Vote className="w-5 h-5" />Bulletin de vote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {hasVoted ? (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 mt-0.5" />
                    <div>
                      <p className="font-medium">Merci, votre vote a été enregistré sur cet appareil.</p>
                      {receipt && (
                        <p className="text-sm text-gray-600 mt-1">Code de reçu : <span className="font-mono">{receipt}</span></p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3">
                      <Label>Nom complet</Label>
                      <Input placeholder="Votre nom et prénom" value={voter.name} onChange={(e) => setVoter({ ...voter, name: e.target.value })} />
                    </div>
                    <div className="grid gap-3">
                      <Label>Téléphone (WhatsApp)</Label>
                      <Input placeholder="Ex: +243 97 ..." value={voter.phone} onChange={(e) => setVoter({ ...voter, phone: e.target.value })} />
                    </div>
                    <div className="grid gap-3">
                      <Label>Remarque (optionnel)</Label>
                      <Textarea placeholder="Votre suggestion pour améliorer le département…" value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    {ELECTION_CONFIG.races.map((race) => (
                      <div key={race.id} className="p-4 rounded-2xl border bg-white">
                        <div className="font-semibold mb-2">{race.title}</div>
                        <RadioGroup value={choices[race.id] || ""} onValueChange={(val) => setChoices({ ...choices, [race.id]: val })}>
                          {race.candidates.map((c) => (
                            <div key={c.id} className="flex items-center space-x-2 py-1">
                              <RadioGroupItem value={c.id} id={`${race.id}-${c.id}`} />
                              <Label htmlFor={`${race.id}-${c.id}`}>{c.name}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    ))}
                    <Button onClick={submitBallot} className="rounded-2xl px-6 mt-3">
                      <Send className="w-4 h-4 mr-2" /> Soumettre mon vote et envoyer sur WhatsApp
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
