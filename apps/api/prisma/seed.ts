/**
 * Prisma-Seed: 1 Tenant + Beispielmodul "293" inkl. minimaler Matrix-Struktur
 * (Handlungsziele, Matrix, ein Kompetenzband mit den drei Gütestufen-Feldern
 * und je einem "Ich kann …"-Deskriptor).
 *
 * Aufruf: `npm run prisma:seed` (lädt .env via dotenv-cli).
 * Idempotent dank upsert auf stabilen Schlüsseln.
 */
import { PrismaClient, CompetenceLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1) Tenant (Demo-Schule)
  const tenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Demo-Berufsfachschule',
      branding: {
        create: {
          primaryColor: '#2563eb',
          displayName: 'Demo-Berufsfachschule',
        },
      },
    },
  });

  // 2) Modul 293
  const module293 = await prisma.module.upsert({
    where: { tenantId_number: { tenantId: tenant.id, number: '293' } },
    update: {},
    create: {
      tenantId: tenant.id,
      number: '293',
      title: {
        de: 'Host für Multimedia-Webauftritt in Betrieb nehmen',
        fr: '',
        it: '',
        en: '',
      },
      description: {
        de: 'Beispielmodul für den KompetenzHub-Piloten.',
        fr: '',
        it: '',
        en: '',
      },
      profession: 'INF',
      status: 'PUBLISHED',
    },
  });

  // 3) Handlungsziele
  const goal1 = await prisma.actionGoal.upsert({
    where: { id: '00000000-0000-0000-0000-0000000a0001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000a0001',
      moduleId: module293.id,
      code: '1',
      text: { de: 'Anforderungen analysieren', fr: '', it: '', en: '' },
      sortOrder: 1,
    },
  });

  // 4) Matrix
  const matrix = await prisma.competenceMatrix.upsert({
    where: { moduleId: module293.id },
    update: {},
    create: {
      moduleId: module293.id,
      version: 1,
      status: 'PUBLISHED',
    },
  });

  // 5) Ein Kompetenzband
  const band = await prisma.competenceBand.upsert({
    where: { id: '00000000-0000-0000-0000-0000000b0001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-0000000b0001',
      matrixId: matrix.id,
      code: 'A1',
      description: { de: 'Webserver in Betrieb nehmen', fr: '', it: '', en: '' },
      sortOrder: 1,
    },
  });

  // Band ↔ Handlungsziel verknüpfen (n:m)
  await prisma.bandActionGoal.upsert({
    where: { bandId_actionGoalId: { bandId: band.id, actionGoalId: goal1.id } },
    update: {},
    create: { bandId: band.id, actionGoalId: goal1.id },
  });

  // 6) Drei Kompetenzfelder (Gütestufen) + Deskriptoren
  const levels: { level: CompetenceLevel; suffix: string; text: string }[] = [
    { level: 'BEGINNER', suffix: 'B', text: 'Ich kann einen Webserver installieren.' },
    {
      level: 'INTERMEDIATE',
      suffix: 'I',
      text: 'Ich kann einen Webserver konfigurieren und absichern.',
    },
    {
      level: 'ADVANCED',
      suffix: 'A',
      text: 'Ich kann einen Webserver für den Produktivbetrieb optimieren.',
    },
  ];

  for (const { level, suffix, text } of levels) {
    const field = await prisma.competenceField.upsert({
      where: { bandId_level: { bandId: band.id, level } },
      update: {},
      create: {
        bandId: band.id,
        level,
        code: `${band.code}${suffix}`,
      },
    });

    await prisma.descriptor.upsert({
      where: { fieldId: field.id },
      update: {},
      create: {
        fieldId: field.id,
        text: { de: text, fr: '', it: '', en: '' },
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed abgeschlossen: Tenant "${tenant.name}", Modul ${module293.number}.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
