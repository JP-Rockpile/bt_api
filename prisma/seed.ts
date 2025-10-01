import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed Sportsbooks
  console.log('📚 Seeding sportsbooks...');
  
  const sportsbooks = [
    {
      key: 'fanduel',
      name: 'FanDuel',
      displayName: 'FanDuel Sportsbook',
      logoUrl: 'https://example.com/logos/fanduel.png',
      deepLinkTemplate: 'fanduel://sports/{sport}/{league}',
      iosScheme: 'fanduel://',
      androidPackage: 'com.fanduel.sportsbook',
      webUrl: 'https://sportsbook.fanduel.com',
      supportedMarkets: ['MONEYLINE', 'SPREAD', 'TOTAL_OVER', 'TOTAL_UNDER', 'PLAYER_PROP'],
      isActive: true,
      displayOrder: 1,
    },
    {
      key: 'draftkings',
      name: 'DraftKings',
      displayName: 'DraftKings Sportsbook',
      logoUrl: 'https://example.com/logos/draftkings.png',
      deepLinkTemplate: 'draftkings://sportsbook/{sport}',
      iosScheme: 'draftkings://',
      androidPackage: 'com.draftkings.sportsbook',
      webUrl: 'https://sportsbook.draftkings.com',
      supportedMarkets: ['MONEYLINE', 'SPREAD', 'TOTAL_OVER', 'TOTAL_UNDER', 'PLAYER_PROP'],
      isActive: true,
      displayOrder: 2,
    },
    {
      key: 'betmgm',
      name: 'BetMGM',
      displayName: 'BetMGM Sportsbook',
      logoUrl: 'https://example.com/logos/betmgm.png',
      webUrl: 'https://sports.betmgm.com',
      supportedMarkets: ['MONEYLINE', 'SPREAD', 'TOTAL_OVER', 'TOTAL_UNDER'],
      isActive: true,
      displayOrder: 3,
    },
    {
      key: 'caesars',
      name: 'Caesars',
      displayName: 'Caesars Sportsbook',
      logoUrl: 'https://example.com/logos/caesars.png',
      webUrl: 'https://sportsbook.caesars.com',
      supportedMarkets: ['MONEYLINE', 'SPREAD', 'TOTAL_OVER', 'TOTAL_UNDER'],
      isActive: true,
      displayOrder: 4,
    },
  ];

  for (const book of sportsbooks) {
    await prisma.sportsbook.upsert({
      where: { key: book.key },
      update: book,
      create: book,
    });
  }

  console.log(`✅ Created ${sportsbooks.length} sportsbooks`);

  // Seed Team Mappings (canonical names for popular teams)
  console.log('🏈 Seeding team mappings...');

  const teamMappings = [
    {
      canonicalName: 'Kansas City Chiefs',
      sport: 'NFL',
      league: 'NFL',
      aliases: {
        unabated: 'Kansas City Chiefs',
        theodds: 'Kansas City Chiefs',
        variants: ['KC Chiefs', 'Chiefs'],
      },
    },
    {
      canonicalName: 'Los Angeles Lakers',
      sport: 'NBA',
      league: 'NBA',
      aliases: {
        unabated: 'Los Angeles Lakers',
        theodds: 'Los Angeles Lakers',
        variants: ['LA Lakers', 'Lakers'],
      },
    },
    {
      canonicalName: 'New York Yankees',
      sport: 'MLB',
      league: 'MLB',
      aliases: {
        unabated: 'New York Yankees',
        theodds: 'New York Yankees',
        variants: ['NY Yankees', 'Yankees'],
      },
    },
  ];

  for (const mapping of teamMappings) {
    await prisma.teamMapping.upsert({
      where: { canonicalName: mapping.canonicalName },
      update: mapping,
      create: mapping,
    });
  }

  console.log(`✅ Created ${teamMappings.length} team mappings`);

  // Seed Sample Events (for development/testing)
  console.log('📅 Seeding sample events...');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(19, 0, 0, 0);

  const events = [
    {
      sportType: 'NFL',
      league: 'NFL',
      homeTeam: 'Kansas City Chiefs',
      awayTeam: 'Buffalo Bills',
      homeTeamCanonical: 'Kansas City Chiefs',
      awayTeamCanonical: 'Buffalo Bills',
      startTime: tomorrow,
      status: 'SCHEDULED' as const,
      venue: 'Arrowhead Stadium',
      externalIds: { test: 'event_001' },
    },
    {
      sportType: 'NBA',
      league: 'NBA',
      homeTeam: 'Los Angeles Lakers',
      awayTeam: 'Boston Celtics',
      homeTeamCanonical: 'Los Angeles Lakers',
      awayTeamCanonical: 'Boston Celtics',
      startTime: tomorrow,
      status: 'SCHEDULED' as const,
      venue: 'Crypto.com Arena',
      externalIds: { test: 'event_002' },
    },
  ];

  for (const event of events) {
    await prisma.event.create({
      data: event,
    });
  }

  console.log(`✅ Created ${events.length} sample events`);

  // Seed Sample Documents for RAG
  console.log('📄 Seeding sample documents...');

  const documents = [
    {
      title: 'Understanding Sports Betting Odds',
      description: 'A comprehensive guide to reading and understanding betting odds',
      content: `
        Sports betting odds represent the probability of an outcome and determine your potential payout.
        American odds use positive and negative numbers. Positive odds (e.g., +150) show how much you'd win on a $100 bet.
        Negative odds (e.g., -110) show how much you need to bet to win $100.
        Understanding implied probability and juice is crucial for finding value bets.
      `,
      sourceType: 'betting_guide',
      sourceUrl: 'https://betthink.com/guides/understanding-odds',
      isActive: true,
    },
    {
      title: 'Closing Line Value (CLV) Explained',
      description: 'Why beating the closing line matters in sports betting',
      content: `
        Closing Line Value (CLV) is a key metric for measuring betting success.
        If you consistently bet at better odds than the closing line, you're demonstrating an edge.
        Sharp bettors and professional gamblers track CLV religiously.
        Positive CLV over a large sample size is one of the best indicators of long-term profitability.
      `,
      sourceType: 'betting_guide',
      sourceUrl: 'https://betthink.com/guides/clv',
      isActive: true,
    },
  ];

  for (const doc of documents) {
    await prisma.document.create({
      data: doc,
    });
  }

  console.log(`✅ Created ${documents.length} sample documents`);

  console.log('✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
