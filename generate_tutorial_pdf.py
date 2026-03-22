from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, Preformatted
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

OUTPUT = "InvadersHunter_Tutorial.pdf"

# ── Color palette (dark text on white background) ──────────────
DARK_BG    = colors.HexColor("#1e1e2e")
ACCENT     = colors.HexColor("#1a5fa8")   # deep blue (headings)
ACCENT2    = colors.HexColor("#1a6e3a")   # dark green (code text)
ACCENT3    = colors.HexColor("#b52a2a")   # dark red
YELLOW     = colors.HexColor("#7a5500")   # dark amber (H3)
MAUVE      = colors.HexColor("#6b3fa0")   # dark purple (H2)
TEXT       = colors.HexColor("#1a1a2e")   # near-black body text
SUBTEXT    = colors.HexColor("#3a3a5a")   # dark grey for secondary text
SURFACE    = colors.HexColor("#ccccdd")   # light grey for table lines
CODE_BG    = colors.HexColor("#f0f0f5")   # very light grey code background
WHITE      = colors.white
BLACK      = colors.black

# ── Document ────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2*cm, bottomMargin=2*cm,
    title="InvadersHunter — Web Dev Tutorial",
    author="Claude Code"
)

styles = getSampleStyleSheet()
story  = []

# ── Custom paragraph styles ─────────────────────────────────────
def S(name, **kw):
    return ParagraphStyle(name, **kw)

H1 = S("H1",
    fontSize=22, leading=28, textColor=ACCENT,
    spaceAfter=10, fontName="Helvetica-Bold")

H2 = S("H2",
    fontSize=15, leading=20, textColor=MAUVE,
    spaceBefore=18, spaceAfter=6, fontName="Helvetica-Bold")

H3 = S("H3",
    fontSize=12, leading=16, textColor=YELLOW,
    spaceBefore=12, spaceAfter=4, fontName="Helvetica-Bold")

BODY = S("BODY",
    fontSize=9.5, leading=14, textColor=TEXT,
    fontName="Helvetica", spaceAfter=6)

BODY_SMALL = S("BODY_SMALL",
    fontSize=8.5, leading=13, textColor=SUBTEXT,
    fontName="Helvetica", spaceAfter=4)

CAPTION = S("CAPTION",
    fontSize=8, leading=11, textColor=SUBTEXT,
    fontName="Helvetica-Oblique", spaceAfter=2)

CODE_STYLE = S("CODE_STYLE",
    fontSize=7.5, leading=11, textColor=ACCENT2,
    fontName="Courier", backColor=CODE_BG,
    leftIndent=10, rightIndent=10,
    spaceBefore=6, spaceAfter=6,
    borderColor=SURFACE, borderWidth=1, borderPadding=6)

BULLET = S("BULLET",
    fontSize=9.5, leading=14, textColor=TEXT,
    fontName="Helvetica", leftIndent=14,
    bulletIndent=4, spaceAfter=3)

# ── Helpers ─────────────────────────────────────────────────────
def h1(text): story.append(Paragraph(text, H1))
def h2(text): story.append(Paragraph(text, H2))
def h3(text): story.append(Paragraph(text, H3))
def p(text):  story.append(Paragraph(text, BODY))
def small(text): story.append(Paragraph(text, BODY_SMALL))
def caption(text): story.append(Paragraph(text, CAPTION))
def sp(n=6):  story.append(Spacer(1, n))
def hr():     story.append(HRFlowable(width="100%", thickness=0.5, color=ACCENT, spaceAfter=4))
def pb():     story.append(PageBreak())

def bullet(items):
    for item in items:
        story.append(Paragraph(f"• {item}", BULLET))
    sp(4)

def code(text):
    story.append(Preformatted(text, CODE_STYLE))

def table(headers, rows, col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,0), colors.HexColor("#1a5fa8")),
        ("TEXTCOLOR",    (0,0), (-1,0), WHITE),
        ("FONTNAME",     (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,-1), 8),
        ("LEADING",      (0,0), (-1,-1), 11),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [WHITE, colors.HexColor("#eef0f8")]),
        ("TEXTCOLOR",    (0,1), (-1,-1), TEXT),
        ("FONTNAME",     (0,1), (-1,-1), "Helvetica"),
        ("ALIGN",        (0,0), (-1,-1), "LEFT"),
        ("VALIGN",       (0,0), (-1,-1), "MIDDLE"),
        ("GRID",         (0,0), (-1,-1), 0.3, SURFACE),
        ("LEFTPADDING",  (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING",   (0,0), (-1,-1), 4),
        ("BOTTOMPADDING",(0,0), (-1,-1), 4),
    ]))
    story.append(t)
    sp(8)

# ═══════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════
sp(80)
story.append(Paragraph("InvadersHunter", S("CoverTitle",
    fontSize=36, leading=44, textColor=ACCENT,
    fontName="Helvetica-Bold", alignment=TA_CENTER)))
sp(8)
story.append(Paragraph("A Web Development Tutorial Through Your Own Code", S("CoverSub",
    fontSize=14, leading=18, textColor=MAUVE,
    fontName="Helvetica-Oblique", alignment=TA_CENTER)))
sp(20)
story.append(HRFlowable(width="60%", thickness=1.5, color=ACCENT, hAlign="CENTER"))
sp(20)
story.append(Paragraph(
    "This document explains how your full-stack application works — file by file, "
    "layer by layer — from a web development learning perspective.",
    S("CoverDesc", fontSize=10, leading=15, textColor=TEXT,
      fontName="Helvetica", alignment=TA_CENTER)))
sp(8)
story.append(Paragraph(
    "Stack: Python · FastAPI · PostgreSQL · React Native · Expo · TypeScript",
    S("CoverStack", fontSize=9, leading=13, textColor=SUBTEXT,
      fontName="Helvetica-Oblique", alignment=TA_CENTER)))
pb()

# ═══════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ═══════════════════════════════════════════════════════════════
h1("Table of Contents")
hr()
toc_items = [
    ("1", "The Big Picture — What is a Full-Stack App?"),
    ("2", "The Tech Stack"),
    ("3", "The Backend — FastAPI + Python"),
    ("  3.1", "What is a Backend?"),
    ("  3.2", "Entry Point: main.py"),
    ("  3.3", "The Database: database.py"),
    ("  3.4", "Models: The Shape of Your Data"),
    ("  3.5", "Schemas: Validating Data In and Out"),
    ("  3.6", "Routers: The API Endpoints"),
    ("  3.7", "Security: Passwords and JWT Tokens"),
    ("  3.8", "Email: The email.py Service"),
    ("  3.9", "Dependencies: dependencies.py"),
    ("4", "The Frontend — React Native + Expo"),
    ("  4.1", "What is a Frontend?"),
    ("  4.2", "React and Components"),
    ("  4.3", "TypeScript: Why .tsx Instead of .js"),
    ("  4.4", "File-Based Routing with Expo Router"),
    ("  4.5", "The Root Layout: _layout.tsx"),
    ("  4.6", "The Tab Layout"),
    ("  4.7", "Screens: map, login, register, forgot-password"),
    ("  4.8", "State Management with Zustand: store.ts"),
    ("  4.9", "The API Client: api-client.ts"),
    ("  4.10", "Feature Services: auth.api.ts & invaders.api.ts"),
    ("  4.11", "Types and Mappers"),
    ("  4.12", "Map Components"),
    ("5", "How Frontend and Backend Talk to Each Other"),
    ("  5.1", "HTTP and REST"),
    ("  5.2", "The Full API Endpoint Table"),
    ("  5.3", "Authentication Flow Step by Step"),
    ("  5.4", "A Request's Full Journey: Flashing an Invader"),
    ("6", "The Database Schema"),
    ("7", "Project Configuration Files"),
    ("8", "Key Web Development Concepts"),
]
for num, title in toc_items:
    is_sub = num.startswith(" ")
    indent = 14 if is_sub else 0
    color = SUBTEXT if is_sub else TEXT
    hex_color = SUBTEXT.hexval()[2:] if is_sub else ACCENT.hexval()[2:]
    story.append(Paragraph(
        f"<font color='#{hex_color}'>{num.strip()}</font>  {title}",
        S(f"toc_{num.strip()}", fontSize=9 if is_sub else 10,
          leading=14, textColor=color, fontName="Helvetica",
          leftIndent=indent, spaceAfter=2)
    ))
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 1 — THE BIG PICTURE
# ═══════════════════════════════════════════════════════════════
h1("1. The Big Picture")
hr()
p("An app like InvadersHunter is split into three layers that each have a clear responsibility "
  "and only communicate with their direct neighbor:")
sp(8)

code(
"""┌─────────────────────────────────────────────────────────┐
│                YOUR PHONE / BROWSER                     │
│                                                         │
│   ┌─────────────────────────────────────────────────┐  │
│   │         FRONTEND  (React Native / Expo)          │  │
│   │  - Draws the UI (map, buttons, forms)            │  │
│   │  - Handles user interactions (taps, input)       │  │
│   │  - Sends HTTP requests to the backend            │  │
│   └──────────────────────┬──────────────────────────┘  │
└──────────────────────────│──────────────────────────────┘
                           │  HTTP  (JSON over the network)
┌──────────────────────────▼──────────────────────────────┐
│                      SERVER  (localhost:8000)            │
│                                                         │
│   ┌─────────────────────────────────────────────────┐  │
│   │         BACKEND  (FastAPI / Python)              │  │
│   │  - Receives HTTP requests                        │  │
│   │  - Validates data & applies business logic       │  │
│   │  - Reads / writes the database                   │  │
│   └──────────────────────┬──────────────────────────┘  │
│                          │  SQL queries                 │
│   ┌──────────────────────▼──────────────────────────┐  │
│   │         DATABASE  (PostgreSQL / Neon)            │  │
│   │  - Stores users, invaders, captures permanently  │  │
│   └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘""")

p("The frontend never touches the database directly — it always goes through the backend. "
  "This separation keeps security, logic, and presentation cleanly isolated.")
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 2 — TECH STACK
# ═══════════════════════════════════════════════════════════════
h1("2. The Tech Stack")
hr()
table(
    ["Layer", "Technology", "Language", "What it does"],
    [
        ["Frontend", "React Native", "TypeScript", "Builds the UI with components"],
        ["Frontend", "Expo", "TypeScript", "Cross-platform build tool (iOS, Android, Web)"],
        ["Frontend", "Expo Router", "TypeScript", "Maps file paths to app screens"],
        ["Frontend", "Zustand", "TypeScript", "Stores global state (auth token, user)"],
        ["Frontend", "Axios", "TypeScript", "Sends HTTP requests to the backend"],
        ["Frontend", "MapLibre GL", "TypeScript", "Renders the interactive map"],
        ["Backend",  "FastAPI", "Python", "HTTP server that handles API requests"],
        ["Backend",  "SQLAlchemy", "Python", "Talks to the database using Python objects"],
        ["Backend",  "Pydantic", "Python", "Validates and serializes data"],
        ["Backend",  "python-jose", "Python", "Creates and verifies JWT auth tokens"],
        ["Backend",  "bcrypt", "Python", "Hashes passwords securely"],
        ["Backend",  "FastAPI-Mail", "Python", "Sends emails (password reset)"],
        ["Backend",  "Alembic", "Python", "Manages database schema migrations"],
        ["Database", "PostgreSQL", "SQL", "Relational database"],
        ["Hosting",  "Neon", "—", "Cloud PostgreSQL provider"],
    ],
    col_widths=[2.5*cm, 3.5*cm, 3*cm, 7*cm]
)
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 3 — THE BACKEND
# ═══════════════════════════════════════════════════════════════
h1("3. The Backend — FastAPI + Python")
hr()

h2("3.1  What is a Backend?")
p("The backend is a program that runs on a server. It listens for HTTP requests (like "
  "\"give me the list of invaders\"), processes them, and sends back HTTP responses "
  "(like \"here are the invaders in JSON format\"). In this project the backend lives "
  "in the <font color='#89b4fa'>backend/</font> folder.")

h2("3.2  Entry Point: main.py")
small("File: backend/app/main.py  —  Language: Python")
p("This is the first file that runs when you start the backend server. It:")
bullet([
    "Creates the FastAPI application object",
    "Configures CORS (which frontends are allowed to call the API)",
    "Registers all the routers (groups of API endpoints)",
])
code(
"""# Simplified version of what main.py does:

app = FastAPI()                      # 1. Create the app

app.add_middleware(CORSMiddleware,   # 2. Allow the frontend to call the API
    allow_origins=["*"],             #    "*" = any origin (fine for dev, not prod)
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)      # 3. Register route groups
app.include_router(users_router)
app.include_router(invaders_router)
app.include_router(progress_router)""")
p("<b>Key concept — CORS:</b> Browsers block JavaScript from calling a different domain unless "
  "the server explicitly allows it. The CORSMiddleware adds "
  "<font color='#a6e3a1'>Access-Control-Allow-Origin</font> headers to responses "
  "so the browser permits the call.")
p("To start the server you run: <font face='Courier' color='#f9e2af'>uvicorn app.main:app --reload</font>  "
  "— uvicorn is the web server that hosts your FastAPI app on port 8000.")

h2("3.3  The Database: database.py")
small("File: backend/app/database.py  —  Language: Python")
p("This file sets up the connection between Python and PostgreSQL using SQLAlchemy.")
code(
"""DATABASE_URL = "postgresql://..."   # Address of the Neon cloud database

engine       = create_engine(DATABASE_URL)  # The connection pool to the DB
SessionLocal = sessionmaker(engine)          # Factory to create DB sessions
Base         = declarative_base()            # Parent class for all DB models""")
bullet([
    "<b>engine</b>: The persistent connection to PostgreSQL.",
    "<b>Session</b>: A unit of work — open it, do reads/writes, commit, close.",
    "<b>Base</b>: Every model class inherits from it; SQLAlchemy creates a table for each.",
])

h2("3.4  Models: The Shape of Your Data")
small("Files: backend/app/models/user.py · space_invader.py · user_progress.py")
p("Models are Python classes that map directly to database tables. SQLAlchemy reads "
  "these classes and creates (or verifies) the corresponding tables.")
code(
"""# user.py — simplified
class User(Base):
    __tablename__ = "users"           # Name of the SQL table

    id              = Column(Integer, primary_key=True)
    username        = Column(String, unique=True)
    email           = Column(String, unique=True)
    hashed_password = Column(String)
    created_at      = Column(DateTime, default=datetime.utcnow)
    is_admin        = Column(Boolean, default=False)""")
p("The three models and their relationship:")
code(
"""users ──────────────── user_progress ──────────────── invaders
  id ◄── user_id (FK)                  invader_id (FK) ──► id

user_progress is a JOIN TABLE: it links a user to an invader with a timestamp.
This implements a many-to-many relationship (one user can find many invaders,
one invader can be found by many users).""")

h2("3.5  Schemas: Validating What Comes In and Goes Out")
small("Files: backend/app/schemas/*.py  —  Language: Python (Pydantic)")
p("While <b>models</b> define the database structure, <b>schemas</b> define the shape "
  "of data coming into and going out of the API.")
code(
"""class UserCreate(BaseModel):       # What the frontend sends at registration
    username: str
    email:    EmailStr               # Pydantic validates this is a real email
    password: str

class UserOut(BaseModel):           # What the backend sends back (NEVER the password!)
    id:         int
    username:   str
    email:      str
    created_at: datetime

    class Config:
        from_attributes = True      # Allows converting a SQLAlchemy model to this schema""")
p("If the frontend sends <font face='Courier' color='#f38ba8'>\"email\": \"not-an-email\"</font>, "
  "Pydantic rejects it with a 422 error before any business logic runs.")

h2("3.6  Routers: The API Endpoints")
small("Files: backend/app/api/routers/*.py")
p("Routers group related endpoints together. Each function decorated with "
  "<font face='Courier' color='#cba6f7'>@router.get(...)</font> or "
  "<font face='Courier' color='#cba6f7'>@router.post(...)</font> becomes one URL "
  "the frontend can call.")
code(
"""# auth.py — simplified
router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    # 1. Find user by username
    user = db.query(User).filter(User.username == request.username).first()

    # 2. Verify the password
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 3. Create and return a JWT token
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}""")
bullet([
    "<font face='Courier' color='#cba6f7'>@router.post(\"/login\")</font> → handles POST http://localhost:8000/auth/login",
    "<font face='Courier' color='#a6e3a1'>request: LoginRequest</font> → Pydantic validates the incoming JSON body automatically",
    "<font face='Courier' color='#a6e3a1'>db: Session = Depends(get_db)</font> → FastAPI injects a database session",
    "<font face='Courier' color='#f38ba8'>raise HTTPException(401)</font> → sends an HTTP 401 error to the frontend",
])

h2("3.7  Security: Passwords and JWT Tokens")
small("File: backend/app/core/security.py")
h3("Password Hashing")
p("Passwords are <b>never stored in plain text</b>. When a user registers:")
code(
"""\"mypassword123\"  →  bcrypt  →  \"$2b$12$xJ3k...long_hash...\"

When logging in, bcrypt checks if the plain password matches the stored hash
without ever reversing it. Even if your database is stolen, passwords are safe.""")
h3("JWT Tokens (JSON Web Token)")
p("After login the backend creates a signed string containing information about the user:")
code(
"""eyJhbGci...  .  eyJzdWIiOiI0...  .  HmacSHA256(...)
  header           payload               signature

Decoded payload:
{
  "sub":      "4",        // user ID
  "is_admin": false,
  "exp":      1740000000  // expiry timestamp
}

The token is SIGNED with a secret key. The backend verifies it hasn't been
tampered with. The frontend stores it and sends it with every request.""")

h2("3.8  Email: The email.py Service")
small("File: backend/app/core/email.py")
p("This file configures SMTP email sending (FastAPI-Mail). Used for:")
bullet([
    "Welcome email when a user registers",
    "Password reset code delivery (6-digit code, 15-minute expiry)",
])
p("The reset codes are stored <b>in-memory</b> in a Python dictionary — they are lost "
  "if the server restarts. A production app would store them in the database.")

h2("3.9  Dependencies: dependencies.py")
small("File: backend/app/dependencies.py")
code(
"""def get_db():
    db = SessionLocal()   # Open a DB session
    try:
        yield db          # Pass it to the endpoint function
    finally:
        db.close()        # Always close it, even on error""")
p("Every endpoint that needs database access declares "
  "<font face='Courier' color='#a6e3a1'>db: Session = Depends(get_db)</font> and FastAPI "
  "automatically calls this generator, passes the session, and closes it after. "
  "This pattern ensures DB connections are never leaked.")
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 4 — THE FRONTEND
# ═══════════════════════════════════════════════════════════════
h1("4. The Frontend — React Native + Expo")
hr()

h2("4.1  What is a Frontend?")
p("The frontend is the code that runs on the user's device (phone or browser). "
  "It draws the interface, handles user interactions, and communicates with the backend. "
  "In this project the frontend lives in <font color='#89b4fa'>frontend/src/</font>.")

h2("4.2  React and Components")
p("React is a JavaScript library for building UIs. The key idea is <b>components</b>: "
  "small, reusable pieces of UI defined as functions.")
code(
"""// A simple React component
function Greeting({ name }: { name: string }) {
    return <Text>Hello, {name}!</Text>;
}

// Used like an HTML tag:
<Greeting name=\"Alice\" />""")
p("React uses <b>JSX</b> (or TSX for TypeScript): a syntax that looks like HTML but is "
  "actually JavaScript/TypeScript. When data changes (like the user logs in), React "
  "<b>automatically re-renders</b> only the components that depend on that data.")

h2("4.3  TypeScript: Why .tsx Instead of .js")
code(
"""// Plain JavaScript — what are a and b? Strings? Numbers?
function add(a, b) { return a + b; }

// TypeScript — explicit and safe
function add(a: number, b: number): number { return a + b; }""")
bullet([
    "Catch bugs at compile time, not at runtime",
    "Better autocomplete in your editor (IntelliSense)",
    "Self-documenting code — types describe the data",
    "<b>.tsx</b> = TypeScript + JSX (TypeScript files containing React components)",
])

h2("4.4  File-Based Routing with Expo Router")
small("Files in: frontend/src/app/")
p("Expo Router turns <b>file paths</b> into <b>app screens</b> automatically. "
  "You don't define routes in code — the file system IS the router.")
code(
"""frontend/src/app/
├── _layout.tsx           →  Root layout (wraps everything)
├── index.tsx             →  \"/\" screen (redirects to map)
├── login.tsx             →  \"/login\" screen
├── register.tsx          →  \"/register\" screen
├── forgot-password.tsx   →  \"/forgot-password\" screen
└── (tabs)/
    ├── _layout.tsx       →  Tab bar layout
    ├── map.tsx           →  \"/map\" tab
    ├── invader.tsx       →  \"/invader\" tab
    └── profile.tsx       →  \"/profile\" tab""")
p("The <font color='#f9e2af'>(tabs)</font> folder name with parentheses is a "
  "<b>route group</b> — it organizes files without adding to the URL. "
  "Files inside share the tab bar layout.")
code(
"""import { router } from 'expo-router';
router.push('/login');     // Navigate to login screen
router.replace('/map');    // Navigate and remove current screen from history""")

h2("4.5  The Root Layout: _layout.tsx")
small("File: frontend/src/app/_layout.tsx")
p("The outermost wrapper of the entire app. Its main job is <b>auth routing</b> — "
  "protecting private screens from unauthenticated users.")
code(
"""export default function RootLayout() {
    const token    = useAuthStore((s) => s.token);  // Read token from Zustand
    const segments = useSegments();                  // Current URL segments

    useEffect(() => {
        const isPublic = ['login','register','forgot-password'].includes(segments[0]);

        if (!token && !isPublic) {
            router.replace('/login');   // Not logged in? Go to login
        } else if (token && isPublic) {
            router.replace('/map');     // Already logged in? Go to map
        }
    }, [token, segments]);   // Re-runs whenever token or route changes

    return <Stack />;         // Render the active screen
}""")

h2("4.6  The Tab Layout")
small("File: frontend/src/app/(tabs)/_layout.tsx")
p("Defines the bottom tab bar shown on all authenticated screens — "
  "the navigation bar with icons for Map, Invaders, and Profile tabs.")

h2("4.7  Screens")
h3("map.tsx — The Main Screen")
small("File: frontend/src/app/(tabs)/map.tsx")
bullet([
    "Fetches all invaders and the user's captures from the API",
    "Combines them with mapInvadersWithProgress to know which are already flashed",
    "Passes everything to the WebMap component for display",
    "Handles flash/unflash actions and updates state",
])
h3("login.tsx — Login Screen")
small("File: frontend/src/app/login.tsx")
p("A form with username and password. On submit, calls loginUser() → the auth store "
  "saves the token → the root layout detects it and redirects to /map.")
h3("forgot-password.tsx — 3-Step Password Reset")
small("File: frontend/src/app/forgot-password.tsx")
p("A single screen with 3 steps controlled by a local step state variable:")
bullet([
    "<b>Step 1:</b> Enter username + email → calls forgotPassword()",
    "<b>Step 2:</b> Enter 6-digit code received by email → calls verifyResetCode()",
    "<b>Step 3:</b> Enter new password → calls resetPassword()",
])

h2("4.8  State Management with Zustand: store.ts")
small("File: frontend/src/features/auth/store.ts")
p("<b>State management</b> = a way to store data that multiple components need to share. "
  "Zustand is a lightweight library for this.")
code(
"""const useAuthStore = create<AuthStore>((set) => ({
    token: null,   // The JWT token (null = not logged in)
    user:  null,   // Parsed user info (id, is_admin, ...)

    login: (token) => {
        const decoded = parseJwt(token);  // Decode JWT to get user info
        set({ token, user: decoded });
    },

    logout: () => set({ token: null, user: null }),
}));

// In any component:
const token        = useAuthStore((s) => s.token);
const { login }    = useAuthStore();""")
p("<b>Why not use a regular variable?</b> React components would not know when it changed "
  "and would not re-render. Zustand's store is <b>reactive</b> — any component that reads "
  "from it re-renders automatically when it changes.")

h2("4.9  The API Client: api-client.ts")
small("File: frontend/src/services/api-client.ts")
p("Creates a configured <b>Axios instance</b> that all API calls use.")
code(
"""const apiClient = axios.create({
    baseURL: 'http://127.0.0.1:8000',   // All calls go to this server
});

// Interceptor: runs automatically before EVERY request
apiClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;  // Add auth header
    }
    return config;
});""")
p("Instead of manually adding the auth token to every API call, the interceptor "
  "does it automatically for all requests.")

h2("4.10  Feature Services")
small("Files: frontend/src/features/auth/services/auth.api.ts · invaders/services/invaders.api.ts")
p("These files contain functions that call specific API endpoints. They are the <b>only place</b> "
  "in the frontend that knows which URLs exist on the backend.")
code(
"""// auth.api.ts
export async function loginUser(username: string, password: string) {
    const res = await apiClient.post('/auth/login', { username, password });
    return res.data;    // { access_token: \"...\", token_type: \"bearer\" }
}

// invaders.api.ts
export async function flashInvader(userId: number, invaderId: number) {
    const res = await apiClient.post('/progress/', { user_id: userId, invader_id: invaderId });
    return res.data;
}""")
p("<b>Why separate these from components?</b> This is <b>separation of concerns</b>: "
  "components handle UI, services handle data fetching. If a URL changes you only "
  "update the service file.")

h2("4.11  Types and Mappers")
small("Files: frontend/src/features/invaders/types.ts · mapper.ts")
code(
"""// types.ts
type Invader = { id: number; name: string; latitude: number; longitude: number; points: number | null; };
type Capture = { id: number; user_id: number; invader_id: number; found_at: string; };
type InvaderWithState = Invader & { isFlashed: boolean; captureId?: number; };

// mapper.ts — merges two lists from separate API calls
function mapInvadersWithProgress(invaders: Invader[], captures: Capture[]): InvaderWithState[] {
    return invaders.map(inv => {
        const capture = captures.find(c => c.invader_id === inv.id);
        return { ...inv, isFlashed: !!capture, captureId: capture?.id };
    });
}""")

h2("4.12  Map Components")
table(
    ["File", "Role"],
    [
        ["web-map.tsx", "MapLibre GL map, places a Marker for each invader, opens popup on click"],
        ["invader-marker.tsx", "Custom pin graphic, changes appearance based on isFlashed state"],
        ["invader-popup.tsx", "Info card showing name/points + Flash or Unflash button"],
    ],
    col_widths=[6*cm, 10*cm]
)
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 5 — HOW THEY TALK
# ═══════════════════════════════════════════════════════════════
h1("5. How Frontend and Backend Talk to Each Other")
hr()

h2("5.1  HTTP and REST")
p("The frontend and backend communicate using <b>HTTP</b> — the same protocol your browser "
  "uses to load web pages.")
p("Each HTTP message has:")
bullet([
    "<b>Method:</b> GET (read), POST (create), PUT (update), DELETE (remove)",
    "<b>URL:</b> the address of the resource (e.g., /invaders/4)",
    "<b>Headers:</b> metadata (e.g., Authorization: Bearer &lt;token&gt;)",
    "<b>Body:</b> the data sent — for POST/PUT, usually JSON",
])
p("<b>REST</b> is a convention for designing these URLs:")
table(
    ["Goal", "Method", "URL"],
    [
        ["Get all invaders",    "GET",    "/invaders/"],
        ["Get one invader",     "GET",    "/invaders/4"],
        ["Create an invader",   "POST",   "/invaders/"],
        ["Update an invader",   "PUT",    "/invaders/4"],
        ["Delete an invader",   "DELETE", "/invaders/4"],
    ],
    col_widths=[5*cm, 3*cm, 8*cm]
)
p("The backend responds with a <b>status code</b>:")
table(
    ["Code", "Meaning"],
    [
        ["200 OK",              "Success"],
        ["201 Created",         "Resource was created"],
        ["401 Unauthorized",    "You need to log in"],
        ["404 Not Found",       "Resource doesn't exist"],
        ["422 Unprocessable",   "Request data failed validation"],
    ],
    col_widths=[4*cm, 12*cm]
)

h2("5.2  The Full API Endpoint Table")
table(
    ["Method", "Endpoint", "Auth?", "Purpose"],
    [
        ["POST",   "/auth/login",               "No",  "Log in, get JWT token"],
        ["POST",   "/auth/forgot-password",     "No",  "Request password reset code"],
        ["POST",   "/auth/verify-reset-code",   "No",  "Verify the 6-digit code"],
        ["POST",   "/auth/reset-password",      "No",  "Set new password"],
        ["GET",    "/users/",                   "Yes", "List all users"],
        ["POST",   "/users/",                   "No",  "Register new user"],
        ["PUT",    "/users/{user_id}",          "Yes", "Update user profile"],
        ["DELETE", "/users/{user_id}",          "Yes", "Delete user"],
        ["GET",    "/invaders/",                "Yes", "Get all invaders with GPS coords"],
        ["POST",   "/invaders/",                "Yes", "Create invader"],
        ["PUT",    "/invaders/{id}",            "Yes", "Update invader"],
        ["DELETE", "/invaders/{id}",            "Yes", "Delete invader"],
        ["GET",    "/progress/",               "Yes", "Get all captures"],
        ["GET",    "/progress/user/{user_id}", "Yes", "Get a user's captures"],
        ["POST",   "/progress/",               "Yes", "Record a capture (flash)"],
        ["PUT",    "/progress/{id}",           "Yes", "Update a capture"],
        ["DELETE", "/progress/{id}",           "Yes", "Remove a capture (unflash)"],
    ],
    col_widths=[1.8*cm, 5.5*cm, 1.5*cm, 7.2*cm]
)

h2("5.3  Authentication Flow Step by Step")
h3("Registration")
code(
"""1. User fills form  →  frontend calls POST /users/ with {username, email, password}
2. Backend validates the data (Pydantic schema)
3. Backend checks username/email not already taken (DB query)
4. Backend hashes the password with bcrypt
5. Backend inserts User row into the database
6. Backend sends welcome email
7. Backend returns the new user data
8. Frontend auto-logs in the user (creates a JWT)
9. Frontend stores token in Zustand
10. Root layout detects token  →  redirects to /map""")
h3("Login")
code(
"""1. User submits username + password
2. Frontend calls POST /auth/login
3. Backend finds user by username (DB query)
4. Backend verifies password with bcrypt.checkpw()
5. If valid: backend creates JWT {sub: user_id, is_admin: false, exp: +30d}
6. Backend returns {access_token: \"eyJ...\"}
7. Zustand store.login() saves the token and parses user ID
8. Root layout detects token  →  redirects to /map""")
h3("Subsequent Requests")
code(
"""1. Frontend calls any protected endpoint (e.g., GET /invaders/)
2. Axios interceptor adds \"Authorization: Bearer eyJ...\" automatically
3. Backend receives request, decodes JWT, identifies user
4. Backend processes request and returns data""")

h2("5.4  A Request's Full Journey: Flashing an Invader")
p("Let's trace exactly what happens when a user taps <b>Flash</b> on an invader popup:")
code(
"""[invader-popup.tsx]
  User taps "Flash" button
  ↓  onFlash() callback called
[map.tsx]
  handleFlash(invaderId) called
  ↓
[invaders.api.ts]
  flashInvader(userId, invaderId)
  ↓
[api-client.ts]
  axios.post('/progress/', {user_id: 4, invader_id: 7})
  + Interceptor adds header: \"Authorization: Bearer eyJ...\"
  ↓
  HTTP POST request travels over the network
  ↓
[main.py]
  FastAPI receives the request, routes it to progress router
  ↓
[user_progress.py router]
  @router.post(\"/progress/\") runs
  Pydantic validates the body
  DB: INSERT INTO user_progress (user_id, invader_id, found_at) VALUES (4, 7, now())
  Returns new UserProgress as JSON
  ↓
[map.tsx]
  Response received  →  state updated  →  invader shown as captured
  React re-renders the marker with the flashed style""")
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 6 — DATABASE SCHEMA
# ═══════════════════════════════════════════════════════════════
h1("6. The Database Schema")
hr()
code(
"""-- Users table
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR UNIQUE NOT NULL,
    email           VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    is_admin        BOOLEAN DEFAULT FALSE
);

-- Invaders table
CREATE TABLE invaders (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR NOT NULL,
    image_url   VARCHAR,
    description VARCHAR,
    points      INTEGER,
    state       VARCHAR,
    latitude    FLOAT,
    longitude   FLOAT
);

-- Captures table (join table between users and invaders)
CREATE TABLE user_progress (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    invader_id  INTEGER REFERENCES invaders(id),
    found_at    TIMESTAMP DEFAULT NOW()
);""")
p("<b>Alembic</b> manages changes to this schema over time. When you add a new column "
  "or table you create an Alembic migration instead of manually running SQL — "
  "this lets the whole team apply the same DB changes safely.")
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 7 — CONFIG FILES
# ═══════════════════════════════════════════════════════════════
h1("7. Project Configuration Files")
hr()
h2("Backend")
table(
    ["File", "Purpose"],
    [
        ["backend/requirements.txt", "Lists Python packages to install (pip install -r requirements.txt)"],
        ["backend/.env",             "Secret env vars (DB URL, JWT secret, email creds). NEVER commit this!"],
        ["backend/.env.example",     "Template showing which env vars are needed, with placeholder values"],
    ],
    col_widths=[5.5*cm, 10.5*cm]
)
h2("Frontend")
table(
    ["File", "Purpose"],
    [
        ["frontend/package.json",  "Lists JS packages and scripts (npm install, npm start)"],
        ["frontend/app.json",      "Expo config: app name, icon, splash screen, plugins"],
        ["frontend/tsconfig.json", "TypeScript compiler options; defines @/* path alias → src/*"],
    ],
    col_widths=[5.5*cm, 10.5*cm]
)
pb()

# ═══════════════════════════════════════════════════════════════
# SECTION 8 — KEY CONCEPTS
# ═══════════════════════════════════════════════════════════════
h1("8. Key Web Development Concepts")
hr()
concepts = [
    ("REST API",
     "A standard convention for designing URLs for data operations. "
     "GET = read, POST = create, PUT = update, DELETE = remove."),
    ("JSON",
     "JavaScript Object Notation — the data format exchanged over HTTP. "
     "Both Python (via Pydantic) and TypeScript (native) understand it natively."),
    ("JWT (JSON Web Token)",
     "A signed token proving a user's identity. Sent in the Authorization header "
     "of every request after login. Carries user ID and role."),
    ("ORM (Object-Relational Mapping)",
     "SQLAlchemy maps Python classes to database tables. You write Python objects "
     "and it generates SQL queries automatically."),
    ("Dependency Injection",
     "FastAPI's Depends() system injects shared objects (like the DB session) into "
     "endpoints automatically, ensuring proper lifecycle management."),
    ("Component-Based UI",
     "React builds UIs from small, reusable functions. State changes trigger "
     "automatic, efficient re-renders of only the affected components."),
    ("State Management",
     "Zustand stores global data (the auth token) that multiple components need. "
     "It is reactive — readers re-render when the state changes."),
    ("Interceptors",
     "Axios interceptors run code before or after every HTTP request — used here "
     "to inject the auth header automatically on all calls."),
    ("File-Based Routing",
     "Expo Router maps file paths directly to screens. No manual route "
     "configuration needed — create a file, get a route."),
    ("CORS",
     "A browser security mechanism. Your backend must explicitly declare which "
     "frontend origins are allowed to call it."),
    ("Environment Variables",
     "Secrets (DB passwords, API keys) are stored in .env files, not in code. "
     "They are loaded at runtime and ignored by git."),
    ("Password Hashing",
     "bcrypt produces a one-way hash of a password. It can be verified but never "
     "reversed — even if your database is compromised, passwords stay safe."),
]
for concept, desc in concepts:
    story.append(Paragraph(
        f"<font color='#89b4fa'><b>{concept}</b></font>",
        S(f"conceptTitle_{concept}", fontSize=10, leading=14, textColor=ACCENT,
          fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=2)))
    p(desc)
sp(20)
story.append(HRFlowable(width="100%", thickness=0.5, color=ACCENT))
sp(6)
story.append(Paragraph(
    "Generated from the InvadersHunter codebase for educational purposes.",
    S("footer", fontSize=8, leading=11, textColor=SUBTEXT,
      fontName="Helvetica-Oblique", alignment=TA_CENTER)))

# ── Build ────────────────────────────────────────────────────────
doc.build(story)
print(f"PDF generated: {OUTPUT}")
