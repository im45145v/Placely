/**
 * One-off local test-data seeder for the MBA hiring workflow.
 *
 * Creates a test university tenant, MBA-focused companies + roles, and a
 * handful of student + placement-admin test accounts (real Appwrite Auth
 * users with server-minted sessions, since the app only supports Google
 * OAuth login and there is no username/password flow to hand out).
 *
 * Run with:
 *   node --env-file=.env.local scripts/seed-mba-test-data.mjs
 *
 * Output: a table of test accounts with a session secret for each. Paste the
 * secret as the value of the `placely_session_<projectId>` cookie (DevTools
 * > Application > Cookies, on localhost) to be logged in as that user.
 */
import { Client, Databases, Users } from "node-appwrite";

const databaseId = process.env.APPWRITE_DATABASE_ID || "placely-db";
for (const key of ["NEXT_PUBLIC_APPWRITE_ENDPOINT", "NEXT_PUBLIC_APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"]) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);
const databases = new Databases(client);
const users = new Users(client);

// Company/role listing (src/lib/companies/service.ts) is ALWAYS scoped by
// Query.equal("universityId", actor.universityId), even for SUPER_ADMIN — no
// cross-tenant view. So MBA test data must be seeded into every tenant a real
// student/admin actually belongs to, not just one. Tenants are discovered
// dynamically from existing `users` docs.
const now = () => new Date().toISOString();

async function discoverTenants() {
  const { documents } = await databases.listDocuments(databaseId, "users", []);
  const tenants = new Set(documents.map((doc) => doc.universityId).filter(Boolean));
  tenants.add("default");
  return [...tenants];
}

async function ensureUniversity(universityId) {
  try {
    await databases.getDocument(databaseId, "universities", universityId);
  } catch {
    await databases.createDocument(databaseId, "universities", universityId, {
      name: `University (${universityId})`,
      domain: `${universityId}.placely.local`,
      logoUrl: "",
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    });
    console.log("Created university:", universityId);
  }
}

const COMPANIES = [
  { id: "co-mckinsey", name: "McKinsey & Company", companyType: "consulting", locations: ["Mumbai", "Delhi"], industry: "Management Consulting" },
  { id: "co-bcg", name: "Boston Consulting Group", companyType: "consulting", locations: ["Bengaluru"], industry: "Management Consulting" },
  { id: "co-goldman", name: "Goldman Sachs", companyType: "finance", locations: ["Mumbai"], industry: "Investment Banking" },
  { id: "co-amazon", name: "Amazon", companyType: "enterprise", locations: ["Bengaluru", "Hyderabad"], industry: "E-commerce / Tech" },
];

async function ensureCompanies(universityId) {
  for (const co of COMPANIES) {
    const id = `${co.id}--${universityId}`;
    try {
      await databases.getDocument(databaseId, "companies", id);
    } catch {
      await databases.createDocument(databaseId, "companies", id, {
        universityId,
        name: co.name,
        logo: "",
        website: "",
        industry: co.industry,
        description: `${co.name} MBA hiring test record.`,
        locations: co.locations,
        companyType: co.companyType,
        contactInfo: JSON.stringify({}),
        participationHistory: JSON.stringify({}),
        isActive: true,
        createdAt: now(),
        updatedAt: now(),
      });
      console.log("Created company:", co.name, "in", universityId);
    }
  }
}

const deadline = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString();

const ROLES = [
  { id: "role-mck-bap", companyId: "co-mckinsey", title: "Business Analyst (Post-MBA)", employmentType: "full_time", ctc: 3200000, skills: ["Case solving", "Strategy", "Data analysis"] },
  { id: "role-bcg-consultant", companyId: "co-bcg", title: "Associate Consultant (MBA)", employmentType: "full_time", ctc: 3000000, skills: ["Consulting", "Client management"] },
  { id: "role-gs-ib", companyId: "co-goldman", title: "Investment Banking Associate", employmentType: "full_time", ctc: 3500000, skills: ["Financial modelling", "Valuation"] },
  { id: "role-amz-pm", companyId: "co-amazon", title: "Product Manager - MBA New Grad", employmentType: "full_time", ctc: 2800000, skills: ["Product strategy", "Analytics"] },
  { id: "role-mck-intern", companyId: "co-mckinsey", title: "Summer Business Analyst Intern", employmentType: "internship", ctc: 200000, skills: ["Case solving"] },
];

async function ensureRoles(universityId) {
  for (const role of ROLES) {
    const id = `${role.id}--${universityId}`;
    const companyId = `${role.companyId}--${universityId}`;
    try {
      await databases.getDocument(databaseId, "roles", id);
    } catch {
      await databases.createDocument(databaseId, "roles", id, {
        companyId,
        universityId,
        title: role.title,
        jdText: `${role.title} — MBA hiring workflow test role.`,
        jdAttachmentId: "",
        location: "Mumbai",
        workMode: "hybrid",
        employmentType: role.employmentType,
        ctc: role.ctc,
        fixedCtc: role.ctc,
        variableCtc: 0,
        joiningDate: "",
        experienceRequirementMonths: 0,
        numberOfOpenings: 5,
        applicationDeadline: deadline,
        selectionProcessDescription: "Resume shortlist -> Case interview -> HR interview",
        eligibilityRuleSetId: "",
        requiredSkills: role.skills,
        requiredQualifications: ["MBA"],
        status: "published",
        createdAt: now(),
        updatedAt: now(),
      });
      console.log("Created role:", role.title, "in", universityId);
    }
  }
}

// One account uses the real inbox so any configured notification email lands there.
// Test accounts (as opposed to seeded companies/roles) live in a single fixed tenant.
const TEST_ACCOUNT_UNIVERSITY_ID = "default";
const ACCOUNTS = [
  { id: "test-admin-1", name: "MBA Test Admin", email: "im45145v+mbaadmin@gmail.com", role: "PLACEMENT_ADMIN" },
  { id: "test-student-1", name: "Test Student One", email: "im45145v+student1@gmail.com", role: "STUDENT" },
  { id: "test-student-2", name: "Test Student Two", email: "im45145v+student2@gmail.com", role: "STUDENT" },
  { id: "test-student-3", name: "Test Student Three", email: "im45145v+student3@gmail.com", role: "STUDENT" },
  { id: "test-student-4", name: "Test Student Four", email: "im45145v+student4@gmail.com", role: "STUDENT" },
  { id: "test-student-5", name: "Test Student Five", email: "im45145v+student5@gmail.com", role: "STUDENT" },
  { id: "test-student-6", name: "Test Student Six", email: "im45145v+student6@gmail.com", role: "STUDENT" },
];

async function ensureAuthUser(account) {
  try {
    return await users.get({ userId: account.id });
  } catch {
    const created = await users.create({
      userId: account.id,
      email: account.email,
      name: account.name,
    });
    console.log("Created auth user:", account.email);
    return created;
  }
}

async function ensureAppUserDoc(account) {
  try {
    const existing = await databases.getDocument(databaseId, "users", account.id);
    if (existing.universityId !== TEST_ACCOUNT_UNIVERSITY_ID) {
      await databases.updateDocument(databaseId, "users", account.id, { universityId: TEST_ACCOUNT_UNIVERSITY_ID });
      console.log("Re-tenanted users doc:", account.email);
    }
  } catch {
    await databases.createDocument(databaseId, "users", account.id, {
      name: account.name,
      email: account.email,
      universityId: TEST_ACCOUNT_UNIVERSITY_ID,
      role: account.role,
      isActive: true,
      onboardingCompletedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    });
    console.log("Created users doc:", account.email);
  }
}

async function ensureStudentProfileDoc(account) {
  if (account.role !== "STUDENT") return;
  try {
    const existing = await databases.getDocument(databaseId, "student_profiles", account.id);
    if (existing.universityId !== TEST_ACCOUNT_UNIVERSITY_ID) {
      await databases.updateDocument(databaseId, "student_profiles", account.id, { universityId: TEST_ACCOUNT_UNIVERSITY_ID });
      console.log("Re-tenanted student_profiles doc:", account.email);
    }
  } catch {
    await databases.createDocument(databaseId, "student_profiles", account.id, {
      userId: account.id,
      universityId: TEST_ACCOUNT_UNIVERSITY_ID,
      personalInfo: JSON.stringify({ fullName: account.name }),
      academic: JSON.stringify({ program: "MBA", specialization: "General Management", graduationYear: 2026 }),
      professional: JSON.stringify({
        previousCompanies: [],
        previousTitles: [],
        internships: [],
        certifications: [],
        skills: ["Excel", "Leadership"],
        projects: [],
      }),
      placement: JSON.stringify({ status: "NOT_PLACED" }),
      customFields: JSON.stringify({}),
      isProfileComplete: true,
      createdAt: now(),
      updatedAt: now(),
    });
    console.log("Created student_profiles doc:", account.email);
  }
}

async function mintSession(account) {
  const session = await users.createSession({ userId: account.id });
  return session.secret;
}

async function main() {
  const tenants = await discoverTenants();
  console.log("Seeding companies/roles into tenants:", tenants.join(", "));
  for (const tenantId of tenants) {
    await ensureUniversity(tenantId);
    await ensureCompanies(tenantId);
    await ensureRoles(tenantId);
  }

  const results = [];
  for (const account of ACCOUNTS) {
    await ensureAuthUser(account);
    await ensureAppUserDoc(account);
    await ensureStudentProfileDoc(account);
    const secret = await mintSession(account);
    results.push({ ...account, secret });
  }

  console.log("\n=== Test account sessions (cookie value for placely_session_<projectId>) ===\n");
  for (const r of results) {
    console.log(`${r.role.padEnd(15)} ${r.email.padEnd(35)} secret=${r.secret}`);
  }
  console.log(
    `\nCookie name: placely_session_${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}\n` +
    "Set it via DevTools > Application > Cookies on http://localhost:3000, HttpOnly, Path=/.\n" +
    "Sessions expire per Appwrite project session length (default 1 year) unless you delete them."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
