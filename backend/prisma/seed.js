import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  ['Peluquerías', 1], ['Barberías', 2], ['Salones de uñas / manicure / pedicure', 3], ['Estéticas', 4],
  ['Maquilladores', 5], ['Spa', 6], ['Depilación / láser', 7], ['Masajistas', 8], ['Tatuadores / piercers', 9],
  ['Niñeras', 10], ['Psicólogos', 11], ['Dentistas', 12], ['Fisioterapeutas', 13], ['Nutricionistas', 14],
  ['Médicos generales', 15], ['Oftalmólogos', 16], ['Veterinarias', 17], ['Clínicas estéticas', 18],
  ['Entrenadores personales', 19], ['Gimnasios', 20], ['Yoga / pilates', 21], ['Crossfit', 22],
  ['Artes marciales', 23], ['Clases de baile', 24], ['Profesores particulares', 25], ['Coaches', 26],
  ['Consultores', 27], ['Clases de idiomas', 28], ['Academias', 29], ['Tutorías', 30], ['Mecánicos', 31],
  ['Electricistas', 32], ['Plomeros', 33], ['Técnicos de PC / celulares', 34], ['Instaladores de internet / CCTV', 35],
  ['Servicio de aire acondicionado', 36], ['Fotógrafos', 37], ['Organizadores de eventos', 38], ['DJs', 39],
  ['Decoradores', 40], ['Limpieza a domicilio', 41], ['Jardineros', 42], ['Entrenadores de perros', 43],
  ['Veterinarios', 44], ['Cuidadores de mascotas', 45],
];

function slug(s) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function main() {
  for (const [name, sort] of categories) {
    await prisma.category.upsert({
      where: { slug: slug(name) },
      update: { name, sort },
      create: { name, slug: slug(name), sort },
    });
  }
  console.log('Seed done');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
