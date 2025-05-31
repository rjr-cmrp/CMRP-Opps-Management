--
-- PostgreSQL database dump
--

-- Dumped from database version 14.17 (Homebrew)
-- Dumped by pg_dump version 14.17 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: forecast_revisions; Type: TABLE; Schema: public; Owner: reuelrivera
--

CREATE TABLE public.forecast_revisions (
    id integer NOT NULL,
    opportunity_uid text NOT NULL,
    old_forecast_date text,
    new_forecast_date text NOT NULL,
    changed_by text,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    comment text
);


ALTER TABLE public.forecast_revisions OWNER TO reuelrivera;

--
-- Name: forecast_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: reuelrivera
--

CREATE SEQUENCE public.forecast_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.forecast_revisions_id_seq OWNER TO reuelrivera;

--
-- Name: forecast_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reuelrivera
--

ALTER SEQUENCE public.forecast_revisions_id_seq OWNED BY public.forecast_revisions.id;


--
-- Name: opportunity_revisions; Type: TABLE; Schema: public; Owner: reuelrivera
--

CREATE TABLE public.opportunity_revisions (
    id integer NOT NULL,
    opportunity_uid uuid,
    revision_number integer NOT NULL,
    changed_by character varying(255),
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    changed_fields jsonb,
    full_snapshot jsonb,
    forecast_date date
);


ALTER TABLE public.opportunity_revisions OWNER TO reuelrivera;

--
-- Name: opportunity_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: reuelrivera
--

CREATE SEQUENCE public.opportunity_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.opportunity_revisions_id_seq OWNER TO reuelrivera;

--
-- Name: opportunity_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reuelrivera
--

ALTER SEQUENCE public.opportunity_revisions_id_seq OWNED BY public.opportunity_revisions.id;


--
-- Name: opps_monitoring; Type: TABLE; Schema: public; Owner: reuelrivera
--

CREATE TABLE public.opps_monitoring (
    encoded_date date,
    project_name text,
    project_code text,
    rev integer,
    client text,
    solutions text,
    sol_particulars text,
    industries text,
    ind_particulars text,
    date_received date,
    client_deadline date,
    decision text,
    account_mgr text,
    pic text,
    bom text,
    status text,
    submitted_date date,
    margin numeric,
    final_amt numeric,
    opp_status text,
    date_awarded_lost date,
    lost_rca text,
    l_particulars text,
    a text,
    c text,
    r text,
    u text,
    d text,
    remarks_comments text,
    uid uuid DEFAULT gen_random_uuid() NOT NULL,
    forecast_date date
);


ALTER TABLE public.opps_monitoring OWNER TO reuelrivera;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: reuelrivera
--

CREATE TABLE public.roles (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.roles OWNER TO reuelrivera;

--
-- Name: roles_id_seq; Type: SEQUENCE; Schema: public; Owner: reuelrivera
--

CREATE SEQUENCE public.roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.roles_id_seq OWNER TO reuelrivera;

--
-- Name: roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: reuelrivera
--

ALTER SEQUENCE public.roles_id_seq OWNED BY public.roles.id;


--
-- Name: user_column_preferences; Type: TABLE; Schema: public; Owner: reuelrivera
--

CREATE TABLE public.user_column_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    page_name text NOT NULL,
    column_settings jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_column_preferences OWNER TO reuelrivera;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: reuelrivera
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id integer NOT NULL
);


ALTER TABLE public.user_roles OWNER TO reuelrivera;

--
-- Name: users; Type: TABLE; Schema: public; Owner: reuelrivera
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    name text,
    is_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    roles text[] DEFAULT ARRAY[]::text[],
    account_type text DEFAULT 'User'::text
);


ALTER TABLE public.users OWNER TO reuelrivera;

--
-- Name: forecast_revisions id; Type: DEFAULT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.forecast_revisions ALTER COLUMN id SET DEFAULT nextval('public.forecast_revisions_id_seq'::regclass);


--
-- Name: opportunity_revisions id; Type: DEFAULT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.opportunity_revisions ALTER COLUMN id SET DEFAULT nextval('public.opportunity_revisions_id_seq'::regclass);


--
-- Name: roles id; Type: DEFAULT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.roles ALTER COLUMN id SET DEFAULT nextval('public.roles_id_seq'::regclass);


--
-- Name: forecast_revisions forecast_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.forecast_revisions
    ADD CONSTRAINT forecast_revisions_pkey PRIMARY KEY (id);


--
-- Name: opportunity_revisions opportunity_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.opportunity_revisions
    ADD CONSTRAINT opportunity_revisions_pkey PRIMARY KEY (id);


--
-- Name: opportunity_revisions opportunity_revisions_uid_rev_unique; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.opportunity_revisions
    ADD CONSTRAINT opportunity_revisions_uid_rev_unique UNIQUE (opportunity_uid, revision_number);


--
-- Name: opps_monitoring opps_monitoring_pkey; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.opps_monitoring
    ADD CONSTRAINT opps_monitoring_pkey PRIMARY KEY (uid);


--
-- Name: opps_monitoring opps_monitoring_uid_key; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.opps_monitoring
    ADD CONSTRAINT opps_monitoring_uid_key UNIQUE (uid);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: user_column_preferences user_column_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.user_column_preferences
    ADD CONSTRAINT user_column_preferences_pkey PRIMARY KEY (id);


--
-- Name: user_column_preferences user_column_preferences_user_id_page_name_key; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.user_column_preferences
    ADD CONSTRAINT user_column_preferences_user_id_page_name_key UNIQUE (user_id, page_name);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_forecast_revisions_uid; Type: INDEX; Schema: public; Owner: reuelrivera
--

CREATE INDEX idx_forecast_revisions_uid ON public.forecast_revisions USING btree (opportunity_uid);


--
-- Name: opportunity_revisions opportunity_revisions_opportunity_uid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.opportunity_revisions
    ADD CONSTRAINT opportunity_revisions_opportunity_uid_fkey FOREIGN KEY (opportunity_uid) REFERENCES public.opps_monitoring(uid) ON DELETE CASCADE;


--
-- Name: user_column_preferences user_column_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.user_column_preferences
    ADD CONSTRAINT user_column_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: reuelrivera
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

