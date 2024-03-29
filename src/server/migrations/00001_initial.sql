-- +goose Up
-- +goose StatementBegin

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: badge_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE badge_type AS ENUM (
    'bottle',
    'region',
    'category'
);

--
-- Name: category; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE category AS ENUM (
    'blend',
    'bourbon',
    'rye',
    'single_grain',
    'single_malt',
    'spirit',
    'single_pot_still'
);

--
-- Name: entity_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE entity_type AS ENUM (
    'brand',
    'distiller',
    'bottler'
);

--
-- Name: external_site_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE external_site_type AS ENUM (
    'astorwines',
    'healthyspirits',
    'totalwines',
    'woodencork',
    'whiskyadvocate',
    'smws',
    'smwsa',
    'totalwine'
);

--
-- Name: follow_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE follow_status AS ENUM (
    'none',
    'pending',
    'following'
);

--
-- Name: identity_provider; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE identity_provider AS ENUM (
    'google'
);

--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE notification_type AS ENUM (
    'comment',
    'toast',
    'friend_request'
);

--
-- Name: object_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE object_type AS ENUM (
    'bottle',
    'edition',
    'entity',
    'tasting',
    'toast',
    'follow',
    'comment'
);

--
--
-- Name: servingStyle; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "servingStyle" AS ENUM (
    'neat',
    'rocks',
    'splash'
);

--
-- Name: type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE "type" AS ENUM (
    'add',
    'update',
    'delete'
);

--
-- Name: badge_award; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE badge_award (
    id bigint NOT NULL,
    badge_id bigint NOT NULL,
    user_id bigint NOT NULL,
    points smallint DEFAULT 0,
    level smallint DEFAULT 0,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE badge_award OWNER TO postgres;

--
-- Name: badge_award_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE badge_award_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: badge_award_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE badge_award_id_seq OWNED BY badge_award.id;


--
-- Name: badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE badges (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    type badge_type NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL
);

--
-- Name: badges_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE badges_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: badges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE badges_id_seq OWNED BY badges.id;


--
-- Name: bottle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE bottle (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    category category,
    brand_id bigint NOT NULL,
    stated_age smallint,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL,
    total_tastings bigint DEFAULT 0 NOT NULL,
    bottler_id bigint,
    full_name character varying(255) NOT NULL,
    avg_rating double precision,
    description text,
    tasting_notes jsonb,
    suggested_tags character varying(64)[] DEFAULT ARRAY[]::character varying[] NOT NULL
);

--
-- Name: bottle_alias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE bottle_alias (
    bottle_id bigint,
    name character varying(255) NOT NULL
);

--
-- Name: bottle_distiller; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE bottle_distiller (
    bottle_id bigint NOT NULL,
    distiller_id bigint NOT NULL
);

--
-- Name: bottle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE bottle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: bottle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE bottle_id_seq OWNED BY bottle.id;


--
-- Name: bottle_tag; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE bottle_tag (
    bottle_id bigint NOT NULL,
    tag character varying(64) NOT NULL,
    count integer DEFAULT 0 NOT NULL
);


--
-- Name: bottle_tombstone; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE bottle_tombstone (
    bottle_id bigint NOT NULL,
    new_bottle_id bigint
);

--
-- Name: change; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE change (
    id bigint NOT NULL,
    object_id bigint NOT NULL,
    object_type object_type NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL,
    type "type" DEFAULT 'add'::"type" NOT NULL,
    display_name text
);

--
-- Name: change_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE change_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: change_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE change_id_seq OWNED BY change.id;


--
-- Name: collection; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE collection (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL,
    total_bottles bigint DEFAULT 0 NOT NULL
);

--
-- Name: collection_bottle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE collection_bottle (
    collection_id bigint NOT NULL,
    bottle_id bigint NOT NULL,
    id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: collection_bottle_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE collection_bottle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: collection_bottle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE collection_bottle_id_seq OWNED BY collection_bottle.id;


--
-- Name: collection_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE collection_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: collection_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE collection_id_seq OWNED BY collection.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE comments (
    id bigint NOT NULL,
    tasting_id bigint NOT NULL,
    comment text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL
);

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE comments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE comments_id_seq OWNED BY comments.id;


--
-- Name: entity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE entity (
    id bigint NOT NULL,
    name text NOT NULL,
    country text,
    region text,
    type entity_type[] NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL,
    total_bottles bigint DEFAULT 0 NOT NULL,
    total_tastings bigint DEFAULT 0 NOT NULL,
    location "geography",
    description text,
    year_established smallint,
    website character varying(255),
    short_name text
);

--
-- Name: entity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE entity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: entity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE entity_id_seq OWNED BY entity.id;

--
-- Name: entity_tombstone; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE entity_tombstone (
    entity_id bigint NOT NULL,
    new_entity_id bigint
);

--
-- Name: external_site; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE external_site (
    id bigint NOT NULL,
    type external_site_type NOT NULL,
    name text NOT NULL,
    last_run_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    next_run_at timestamp without time zone,
    run_every integer DEFAULT 60
);

--
-- Name: external_site_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE external_site_config (
    external_site_id bigint NOT NULL,
    key character varying(255) NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: external_site_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE external_site_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: external_site_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE external_site_id_seq OWNED BY external_site.id;


--
-- Name: flight; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE flight (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    public boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL,
    public_id character varying(12) NOT NULL
);

--
-- Name: flight_bottle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE flight_bottle (
    flight_id bigint NOT NULL,
    bottle_id bigint NOT NULL
);

--
-- Name: flight_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE flight_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: flight_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE flight_id_seq OWNED BY flight.id;


--
-- Name: follow; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE follow (
    from_user_id bigint NOT NULL,
    to_user_id bigint NOT NULL,
    status follow_status DEFAULT 'pending'::follow_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    id bigint NOT NULL
);

--
-- Name: follow_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE follow_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: follow_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE follow_id_seq OWNED BY follow.id;

--
-- Name: identity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE identity (
    id bigint NOT NULL,
    provider identity_provider NOT NULL,
    external_id text NOT NULL,
    user_id bigint NOT NULL
);

--
-- Name: identity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE identity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: identity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE identity_id_seq OWNED BY identity.id;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    from_user_id bigint,
    object_id bigint NOT NULL,
    type notification_type NOT NULL,
    created_at timestamp without time zone NOT NULL,
    read boolean DEFAULT false NOT NULL
);

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE notifications_id_seq OWNED BY notifications.id;


--
-- Name: review; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE review (
    id bigint NOT NULL,
    external_site_id bigint NOT NULL,
    name text NOT NULL,
    bottle_id bigint,
    rating integer NOT NULL,
    issue text NOT NULL,
    url text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);

--
-- Name: review_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE review_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: review_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE review_id_seq OWNED BY review.id;


--
-- Name: store_price; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE store_price (
    id bigint NOT NULL,
    external_site_id bigint NOT NULL,
    name text NOT NULL,
    bottle_id bigint,
    price integer NOT NULL,
    url text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    volume integer NOT NULL
);

--
-- Name: store_price_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE store_price_history (
    id bigint NOT NULL,
    price_id bigint NOT NULL,
    price integer NOT NULL,
    date date DEFAULT now() NOT NULL,
    volume integer NOT NULL
);

--
-- Name: store_price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE store_price_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: store_price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE store_price_history_id_seq OWNED BY store_price_history.id;


--
-- Name: store_price_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE store_price_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: store_price_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE store_price_id_seq OWNED BY store_price.id;


--
-- Name: tasting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE tasting (
    id bigint NOT NULL,
    bottle_id bigint NOT NULL,
    notes text,
    tags character varying(64)[] DEFAULT ARRAY[]::character varying[] NOT NULL,
    rating double precision,
    image_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL,
    toasts integer DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    serving_style "servingStyle",
    friends bigint[] DEFAULT ARRAY[]::bigint[] NOT NULL,
    flight_id bigint
);

--
-- Name: tasting_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE tasting_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: tasting_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE tasting_id_seq OWNED BY tasting.id;


--
-- Name: toasts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE toasts (
    tasting_id bigint NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by_id bigint NOT NULL,
    id bigint NOT NULL
);

--
-- Name: toasts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE toasts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: toasts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE toasts_id_seq OWNED BY toasts.id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE "user" (
    id bigint NOT NULL,
    email text NOT NULL,
    password_hash character varying(256),
    display_name text,
    picture_url text,
    active boolean DEFAULT true NOT NULL,
    admin boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    mod boolean DEFAULT false NOT NULL,
    username text NOT NULL,
    private boolean DEFAULT false NOT NULL
);

--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE user_id_seq OWNED BY "user".id;

--
-- Name: badge_award id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY badge_award ALTER COLUMN id SET DEFAULT nextval('badge_award_id_seq'::regclass);


--
-- Name: badges id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY badges ALTER COLUMN id SET DEFAULT nextval('badges_id_seq'::regclass);


--
-- Name: bottle id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle ALTER COLUMN id SET DEFAULT nextval('bottle_id_seq'::regclass);


--
-- Name: change id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY change ALTER COLUMN id SET DEFAULT nextval('change_id_seq'::regclass);


--
-- Name: collection id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY collection ALTER COLUMN id SET DEFAULT nextval('collection_id_seq'::regclass);


--
-- Name: collection_bottle id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY collection_bottle ALTER COLUMN id SET DEFAULT nextval('collection_bottle_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY comments ALTER COLUMN id SET DEFAULT nextval('comments_id_seq'::regclass);


--
-- Name: entity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY entity ALTER COLUMN id SET DEFAULT nextval('entity_id_seq'::regclass);


--
-- Name: external_site id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY external_site ALTER COLUMN id SET DEFAULT nextval('external_site_id_seq'::regclass);


--
-- Name: flight id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY flight ALTER COLUMN id SET DEFAULT nextval('flight_id_seq'::regclass);


--
-- Name: follow id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY follow ALTER COLUMN id SET DEFAULT nextval('follow_id_seq'::regclass);


--
-- Name: identity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY identity ALTER COLUMN id SET DEFAULT nextval('identity_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY notifications ALTER COLUMN id SET DEFAULT nextval('notifications_id_seq'::regclass);


--
-- Name: review id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY review ALTER COLUMN id SET DEFAULT nextval('review_id_seq'::regclass);


--
-- Name: store_price id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY store_price ALTER COLUMN id SET DEFAULT nextval('store_price_id_seq'::regclass);


--
-- Name: store_price_history id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY store_price_history ALTER COLUMN id SET DEFAULT nextval('store_price_history_id_seq'::regclass);


--
-- Name: tasting id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY tasting ALTER COLUMN id SET DEFAULT nextval('tasting_id_seq'::regclass);


--
-- Name: toasts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY toasts ALTER COLUMN id SET DEFAULT nextval('toasts_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "user" ALTER COLUMN id SET DEFAULT nextval('user_id_seq'::regclass);

--
-- Name: badge_award badge_award_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY badge_award
    ADD CONSTRAINT badge_award_pkey PRIMARY KEY (id);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: bottle_alias bottle_alias_name_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_alias
    ADD CONSTRAINT bottle_alias_name_pk PRIMARY KEY (name);


--
-- Name: bottle_distiller bottle_distiller_bottle_id_distiller_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_distiller
    ADD CONSTRAINT bottle_distiller_bottle_id_distiller_id PRIMARY KEY (bottle_id, distiller_id);


--
-- Name: bottle bottle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle
    ADD CONSTRAINT bottle_pkey PRIMARY KEY (id);


--
-- Name: bottle_tag bottle_tag_bottle_id_tag; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_tag
    ADD CONSTRAINT bottle_tag_bottle_id_tag PRIMARY KEY (bottle_id, tag);


--
-- Name: bottle_tombstone bottle_tombstone_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_tombstone
    ADD CONSTRAINT bottle_tombstone_pkey PRIMARY KEY (bottle_id);


--
-- Name: change change_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY change
    ADD CONSTRAINT change_pkey PRIMARY KEY (id);


--
-- Name: collection_bottle collection_bottle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY collection_bottle
    ADD CONSTRAINT collection_bottle_pkey PRIMARY KEY (id);


--
-- Name: collection collection_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY collection
    ADD CONSTRAINT collection_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: entity entity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY entity
    ADD CONSTRAINT entity_pkey PRIMARY KEY (id);


--
-- Name: entity_tombstone entity_tombstone_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY entity_tombstone
    ADD CONSTRAINT entity_tombstone_pkey PRIMARY KEY (entity_id);


--
-- Name: external_site_config external_site_config_external_site_id_key_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY external_site_config
    ADD CONSTRAINT external_site_config_external_site_id_key_pk PRIMARY KEY (external_site_id, key);


--
-- Name: external_site external_site_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY external_site
    ADD CONSTRAINT external_site_pkey PRIMARY KEY (id);


--
-- Name: flight_bottle flight_bottle_flight_id_bottle_id; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY flight_bottle
    ADD CONSTRAINT flight_bottle_flight_id_bottle_id PRIMARY KEY (flight_id, bottle_id);


--
-- Name: flight flight_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY flight
    ADD CONSTRAINT flight_pkey PRIMARY KEY (id);


--
-- Name: follow follow_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY follow
    ADD CONSTRAINT follow_pkey PRIMARY KEY (id);


--
-- Name: identity identity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY identity
    ADD CONSTRAINT identity_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: review review_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY review
    ADD CONSTRAINT review_pkey PRIMARY KEY (id);


--
-- Name: review review_url_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY review
    ADD CONSTRAINT review_url_unique UNIQUE (url);


--
-- Name: store_price_history store_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY store_price_history
    ADD CONSTRAINT store_price_history_pkey PRIMARY KEY (id);


--
-- Name: store_price store_price_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY store_price
    ADD CONSTRAINT store_price_pkey PRIMARY KEY (id);


--
-- Name: tasting tasting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY tasting
    ADD CONSTRAINT tasting_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: badge_award_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX badge_award_unq ON badge_award USING btree (badge_id, user_id);


--
-- Name: badge_name_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX badge_name_unq ON badges USING btree (name);


--
-- Name: bottle_alias_bottle_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bottle_alias_bottle_idx ON bottle_alias USING btree (bottle_id);


--
-- Name: bottle_bottler_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bottle_bottler_idx ON bottle USING btree (bottler_id);


--
-- Name: bottle_brand_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bottle_brand_idx ON bottle USING btree (brand_id);


--
-- Name: bottle_brand_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bottle_brand_unq ON bottle USING btree (name, brand_id);


--
-- Name: bottle_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bottle_created_by_idx ON bottle USING btree (created_by_id);


--
-- Name: bottle_full_name_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX bottle_full_name_unq ON bottle USING btree (lower((full_name)::text));


--
-- Name: change_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX change_created_by_idx ON change USING btree (created_by_id);


--
-- Name: collection_bottle_bottle_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collection_bottle_bottle_idx ON collection_bottle USING btree (bottle_id);


--
-- Name: collection_bottle_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX collection_bottle_unq ON collection_bottle USING btree (collection_id, bottle_id);


--
-- Name: collection_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX collection_created_by_idx ON collection USING btree (created_by_id);


--
-- Name: collection_name_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX collection_name_unq ON collection USING btree (name, created_by_id);


--
-- Name: comment_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX comment_unq ON comments USING btree (tasting_id, created_by_id, created_at);


--
-- Name: entity_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX entity_created_by_idx ON entity USING btree (created_by_id);


--
-- Name: entity_name_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX entity_name_unq ON entity USING btree (lower(name));


--
-- Name: external_site_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX external_site_type ON external_site USING btree (type);


--
-- Name: flight_public_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX flight_public_id ON flight USING btree (public_id);


--
-- Name: follow_to_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX follow_to_user_idx ON follow USING btree (to_user_id);


--
-- Name: follow_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX follow_unq ON follow USING btree (from_user_id, to_user_id);


--
-- Name: identity_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX identity_unq ON identity USING btree (provider, external_id);


--
-- Name: identity_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX identity_user_idx ON identity USING btree (user_id);


--
-- Name: notifications_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notifications_unq ON notifications USING btree (user_id, object_id, type, created_at);


--
-- Name: review_bottle_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX review_bottle_idx ON review USING btree (bottle_id);


--
-- Name: review_unq_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX review_unq_name ON review USING btree (external_site_id, name, issue);


--
-- Name: store_price_bottle_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX store_price_bottle_idx ON store_price USING btree (bottle_id);


--
-- Name: store_price_history_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX store_price_history_unq ON store_price_history USING btree (price_id, volume, date);


--
-- Name: store_price_unq_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX store_price_unq_name ON store_price USING btree (external_site_id, name, volume);


--
-- Name: tasting_bottle_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasting_bottle_idx ON tasting USING btree (bottle_id);


--
-- Name: tasting_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasting_created_by_idx ON tasting USING btree (created_by_id);


--
-- Name: tasting_flight_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tasting_flight_idx ON tasting USING btree (flight_id);


--
-- Name: tasting_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tasting_unq ON tasting USING btree (bottle_id, created_by_id, created_at);


--
-- Name: toast_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX toast_unq ON toasts USING btree (tasting_id, created_by_id);


--
-- Name: user_email_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_email_unq ON "user" USING btree (email);


--
-- Name: user_username_unq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_username_unq ON "user" USING btree (username);


--
-- Name: badge_award badge_award_badge_id_badges_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY badge_award
    ADD CONSTRAINT badge_award_badge_id_badges_id_fk FOREIGN KEY (badge_id) REFERENCES badges(id);


--
-- Name: badge_award badge_award_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY badge_award
    ADD CONSTRAINT badge_award_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);


--
-- Name: bottle_alias bottle_alias_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_alias
    ADD CONSTRAINT bottle_alias_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: bottle bottle_bottler_id_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle
    ADD CONSTRAINT bottle_bottler_id_entity_id_fk FOREIGN KEY (bottler_id) REFERENCES entity(id);


--
-- Name: bottle bottle_brand_id_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle
    ADD CONSTRAINT bottle_brand_id_entity_id_fk FOREIGN KEY (brand_id) REFERENCES entity(id);


--
-- Name: bottle bottle_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle
    ADD CONSTRAINT bottle_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: bottle_distiller bottle_distiller_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_distiller
    ADD CONSTRAINT bottle_distiller_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: bottle_distiller bottle_distiller_distiller_id_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_distiller
    ADD CONSTRAINT bottle_distiller_distiller_id_entity_id_fk FOREIGN KEY (distiller_id) REFERENCES entity(id);


--
-- Name: bottle_tag bottle_tag_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY bottle_tag
    ADD CONSTRAINT bottle_tag_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: change change_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY change
    ADD CONSTRAINT change_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: collection_bottle collection_bottle_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY collection_bottle
    ADD CONSTRAINT collection_bottle_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: collection_bottle collection_bottle_collection_id_collection_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY collection_bottle
    ADD CONSTRAINT collection_bottle_collection_id_collection_id_fk FOREIGN KEY (collection_id) REFERENCES collection(id);


--
-- Name: collection collection_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY collection
    ADD CONSTRAINT collection_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: comments comments_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: comments comments_tasting_id_tasting_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY comments
    ADD CONSTRAINT comments_tasting_id_tasting_id_fk FOREIGN KEY (tasting_id) REFERENCES tasting(id);


--
-- Name: entity entity_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY entity
    ADD CONSTRAINT entity_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: external_site_config external_site_config_external_site_id_external_site_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY external_site_config
    ADD CONSTRAINT external_site_config_external_site_id_external_site_id_fk FOREIGN KEY (external_site_id) REFERENCES external_site(id);


--
-- Name: flight_bottle flight_bottle_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY flight_bottle
    ADD CONSTRAINT flight_bottle_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: flight_bottle flight_bottle_flight_id_flight_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY flight_bottle
    ADD CONSTRAINT flight_bottle_flight_id_flight_id_fk FOREIGN KEY (flight_id) REFERENCES flight(id);


--
-- Name: flight flight_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY flight
    ADD CONSTRAINT flight_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: follow follow_from_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY follow
    ADD CONSTRAINT follow_from_user_id_user_id_fk FOREIGN KEY (from_user_id) REFERENCES "user"(id);


--
-- Name: follow follow_to_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY follow
    ADD CONSTRAINT follow_to_user_id_user_id_fk FOREIGN KEY (to_user_id) REFERENCES "user"(id);


--
-- Name: identity identity_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY identity
    ADD CONSTRAINT identity_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);


--
-- Name: notifications notifications_from_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_from_user_id_user_id_fk FOREIGN KEY (from_user_id) REFERENCES "user"(id);


--
-- Name: notifications notifications_user_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_user_id_user_id_fk FOREIGN KEY (user_id) REFERENCES "user"(id);


--
-- Name: review review_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY review
    ADD CONSTRAINT review_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: review review_external_site_id_external_site_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY review
    ADD CONSTRAINT review_external_site_id_external_site_id_fk FOREIGN KEY (external_site_id) REFERENCES external_site(id);


--
-- Name: store_price store_price_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY store_price
    ADD CONSTRAINT store_price_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: store_price store_price_external_site_id_external_site_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY store_price
    ADD CONSTRAINT store_price_external_site_id_external_site_id_fk FOREIGN KEY (external_site_id) REFERENCES external_site(id);


--
-- Name: store_price_history store_price_history_price_id_store_price_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY store_price_history
    ADD CONSTRAINT store_price_history_price_id_store_price_id_fk FOREIGN KEY (price_id) REFERENCES store_price(id);


--
-- Name: tasting tasting_bottle_id_bottle_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY tasting
    ADD CONSTRAINT tasting_bottle_id_bottle_id_fk FOREIGN KEY (bottle_id) REFERENCES bottle(id);


--
-- Name: tasting tasting_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY tasting
    ADD CONSTRAINT tasting_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: tasting tasting_flight_id_flight_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY tasting
    ADD CONSTRAINT tasting_flight_id_flight_id_fk FOREIGN KEY (flight_id) REFERENCES flight(id);


--
-- Name: toasts toasts_created_by_id_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY toasts
    ADD CONSTRAINT toasts_created_by_id_user_id_fk FOREIGN KEY (created_by_id) REFERENCES "user"(id);


--
-- Name: toasts toasts_tasting_id_tasting_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY toasts
    ADD CONSTRAINT toasts_tasting_id_tasting_id_fk FOREIGN KEY (tasting_id) REFERENCES tasting(id);


--
-- PostgreSQL database dump complete
--


-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP 
-- +goose StatementEnd
