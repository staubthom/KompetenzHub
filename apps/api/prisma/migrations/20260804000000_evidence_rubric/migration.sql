-- Bewertungskriterien-Dokument je Nachweis (KI-Assistenz FA-70/72).
-- Nur für Lehrpersonen sichtbar; `rubricText` ist der extrahierte Text für den Prompt.
ALTER TABLE "CompetenceEvidence" ADD COLUMN     "rubricKey" TEXT,
ADD COLUMN     "rubricName" TEXT,
ADD COLUMN     "rubricText" TEXT;
