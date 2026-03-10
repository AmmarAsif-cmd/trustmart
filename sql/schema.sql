-- ─── TRUSTMART DATABASE SCHEMA ───────────────────────────────────────────────
-- Run this entire file in Supabase SQL Editor

-- ORDERS table
create table if not exists orders (
  id text primary key,
  date date not null,
  status text not null check (status in ('delivered','returned','inTransit','pending','failed')),
  tracking text,
  city text,
  product_cost integer not null default 135,
  source text default 'manual', -- 'seed', 'telegram', 'manual'
  created_at timestamptz default now()
);

-- AD SPEND table
create table if not exists ad_spend (
  id text primary key,
  date date not null,
  pkr integer not null,
  gbp numeric(8,2) default 0,
  note text,
  source text default 'manual',
  created_at timestamptz default now()
);

-- PAYMENTS table (R&S HBL transfers)
create table if not exists payments (
  id text primary key,
  date date not null,
  amount integer not null,
  note text,
  source text default 'manual',
  created_at timestamptz default now()
);

-- SETTINGS table
create table if not exists settings (
  key text primary key,
  value text not null
);
insert into settings (key, value) values
  ('product_cost_new', '135'),
  ('gbp_to_pkr', '355'),
  ('selling_price', '999'),
  ('avg_delivery_charge', '212')
on conflict (key) do nothing;

-- Enable Row Level Security (open read for dashboard, write via service key only)
alter table orders enable row level security;
alter table ad_spend enable row level security;
alter table payments enable row level security;
alter table settings enable row level security;

-- Allow public read (dashboard can read without auth)
create policy "public read orders" on orders for select using (true);
create policy "public read ad_spend" on ad_spend for select using (true);
create policy "public read payments" on payments for select using (true);
create policy "public read settings" on settings for select using (true);

-- Writes are done via the service role key (used by the Telegram bot).
-- The service role bypasses RLS entirely, so no insert/update policies are needed here.
-- Do NOT add open insert/update policies — that would allow anyone with the anon key to write.

-- ─── SEED DATA: All 117 historical orders ────────────────────────────────────
insert into orders (id, date, status, tracking, city, product_cost, source) values
('s1','2026-01-25','returned','HZ7503955365','Naran Mandi',190,'seed'),
('s2','2026-01-25','delivered','HZ7503955366','Varpal Chattha',190,'seed'),
('s3','2026-01-25','delivered','HZ7503955367','Ladhay Wala Goraya',190,'seed'),
('s4','2026-01-25','returned','HZ7503955368','Lahore',190,'seed'),
('s5','2026-01-25','returned','HZ7503955369','Peshawar',190,'seed'),
('s6','2026-01-25','delivered','HZ7503955370','Jahker',190,'seed'),
('s7','2026-01-25','delivered','HZ7503955371','Bahawalnagar',190,'seed'),
('s8','2026-01-27','delivered','HZ7503955395','Gujranwala',190,'seed'),
('s9','2026-01-27','returned','HZ7503955396','Sheikhupura',190,'seed'),
('s10','2026-01-27','delivered','HZ7503955397','Karachi',190,'seed'),
('s11','2026-01-29','returned','LE7524473158','Faisalabad',190,'seed'),
('s12','2026-01-29','returned','LE7524473159','Fazilpur',190,'seed'),
('s13','2026-01-29','delivered','LE7524473162','Sialkot',190,'seed'),
('s14','2026-01-29','returned','LE7524473163','Nowshera',190,'seed'),
('s15','2026-01-29','delivered','LE7524473165','Gujrat',190,'seed'),
('s16','2026-01-29','returned','LE7524473170','Karachi',190,'seed'),
('s17','2026-01-29','delivered','LE7524473172','Nowshera Virkan',190,'seed'),
('s18','2026-01-29','returned','LE7524473174','Sargodha',190,'seed'),
('s19','2026-01-29','returned','LE7524473202','Fatehjang',190,'seed'),
('s20','2026-02-02','delivered','LE7524516032','Karachi',190,'seed'),
('s21','2026-02-02','delivered','LE7524516040','DG Khan',190,'seed'),
('s22','2026-02-02','delivered','LE7524516031','Faisalabad',190,'seed'),
('s23','2026-02-02','delivered','LE7524516028','Kot Radha Kishan',190,'seed'),
('s24','2026-02-02','returned','LE7524516027','Islamabad',190,'seed'),
('s25','2026-02-02','delivered','LE7524516026','Hassan Abdal',190,'seed'),
('s26','2026-02-02','delivered','LE7524516025','Gujranwala',190,'seed'),
('s27','2026-02-02','delivered','LE7524516024','Karachi',190,'seed'),
('s28','2026-02-02','delivered','LE7524516019','Khushab',190,'seed'),
('s29','2026-02-02','delivered','LE7524516018','Sukkur',190,'seed'),
('s30','2026-02-02','returned','LE7524516017','Tharusha',190,'seed'),
('s31','2026-02-02','returned','LE7524516016','Rawalpindi',190,'seed'),
('s32','2026-02-02','delivered','LE7524516015','Sialkot',190,'seed'),
('s33','2026-02-02','delivered','LE7524516001','Sialkot',190,'seed'),
('s34','2026-02-04','returned','LE7524556800','Kabal Swat',190,'seed'),
('s35','2026-02-04','delivered','LE7524556801','Peshawar',190,'seed'),
('s36','2026-02-04','returned','LE7524556802','Khangarh',190,'seed'),
('s37','2026-02-04','delivered','LE7524556803','Peshawar',190,'seed'),
('s38','2026-02-04','returned','LE7524556804','Jhang',190,'seed'),
('s39','2026-02-04','delivered','LE7524556805','Faisalabad',190,'seed'),
('s40','2026-02-04','returned','LE7524556806','Multan',190,'seed'),
('s41','2026-02-04','delivered','LE7524556807','Multan',190,'seed'),
('s42','2026-02-04','delivered','LE7524556808','Toba Tek Singh',190,'seed'),
('s43','2026-02-04','returned','LE7524556809','Karachi',190,'seed'),
('s44','2026-02-14','delivered','LE7524695269','Ubauro Sindh',190,'seed'),
('s45','2026-02-14','delivered','LE7524695270','Lahore',190,'seed'),
('s46','2026-02-14','returned','LE7524695271','Kot Addu',190,'seed'),
('s47','2026-02-14','delivered','LE7524695272','Hyderabad',190,'seed'),
('s48','2026-02-14','delivered','LE7524695273','Muzaffargarh',190,'seed'),
('s49','2026-02-14','delivered','LE7524695274','Mangla',190,'seed'),
('s50','2026-02-14','delivered','LE7524695275','Gujranwala',190,'seed'),
('s51','2026-02-14','delivered','LE7524695276','Sialkot',190,'seed'),
('s52','2026-02-14','delivered','LE7524695277','Karachi',190,'seed'),
('s53','2026-02-14','delivered','LE7524695278','Lahore',190,'seed'),
('s54','2026-02-14','delivered','LE7524695280','Multan',190,'seed'),
('s55','2026-02-14','returned','LE7524695281','DG Khan',190,'seed'),
('s56','2026-02-14','inTransit','LE7524695282','Gujrat',190,'seed'),
('s57','2026-02-14','delivered','LE7524695283','Sahiwal',190,'seed'),
('s58','2026-02-14','delivered','LE7524695284','Gujrat',190,'seed'),
('s59','2026-02-14','returned','LE7524695285','Multan',190,'seed'),
('s60','2026-02-14','delivered','LE7524695286','Chichawatni',190,'seed'),
('s61','2026-02-14','returned','LE7524695287','Faisalabad',190,'seed'),
('s62','2026-02-14','delivered','LE7524695288','Sheikhupura',190,'seed'),
('s63','2026-02-14','returned','LE7524695290','Lahore',190,'seed'),
('s64','2026-02-14','returned','LE7524695304','Faisalabad',190,'seed'),
('s65','2026-02-19','inTransit','LE7526797549','Hyderabad',190,'seed'),
('s66','2026-02-19','delivered','LE7526797550','Rahim Yar Khan',190,'seed'),
('s67','2026-02-19','pending','LE7526797551','Peshawar',190,'seed'),
('s68','2026-02-19','inTransit','LE7526797552','Gujranwala',190,'seed'),
('s69','2026-02-19','delivered','LE7526797553','Pasrur',190,'seed'),
('s70','2026-02-19','inTransit','LE7526797554','Wah Cantt',190,'seed'),
('s71','2026-02-19','delivered','LE7526797555','Gujranwala',190,'seed'),
('s72','2026-02-19','inTransit','LE7526797557','Muridke',190,'seed'),
('s73','2026-02-19','delivered','LE7526797558','Mirpurkhas',190,'seed'),
('s74','2026-02-21','delivered','LE7526836750','Bhakkar',190,'seed'),
('s75','2026-02-21','delivered','LE7526836751','Gojra',190,'seed'),
('s76','2026-02-21','delivered','LE7526836755','Nankana Sahib',190,'seed'),
('s77','2026-02-21','delivered','LE7526836758','Multan',190,'seed'),
('s78','2026-02-21','delivered','LE7526836760','Attock',190,'seed'),
('s79','2026-02-21','delivered','LE7526836761','Peshawar',190,'seed'),
('s80','2026-02-21','delivered','LE7526836762','Karachi',190,'seed'),
('s81','2026-02-21','inTransit','LE7526836766','Multan',190,'seed'),
('s82','2026-02-21','delivered','LE7526836767','Nosharo Feroze',190,'seed'),
('s83','2026-02-21','inTransit','LE7526836895','Islamabad',190,'seed'),
('s84','2026-02-21','delivered','LE7526836896','Tando Allahyar',190,'seed'),
('s85','2026-02-25','pending','121830108','Sialkot',190,'seed'),
('s86','2026-02-25','pending','121830109','Kotli AJK',190,'seed'),
('s87','2026-02-25','pending','121830110','Rawalpindi',190,'seed'),
('s88','2026-02-25','pending','121830111','Layyah',190,'seed'),
('s89','2026-02-25','pending','121830112','Multan',190,'seed'),
('s90','2026-02-25','pending','121830113','Sialkot',190,'seed'),
('s91','2026-02-28','delivered','LE7526936811','Karachi',190,'seed'),
('s92','2026-02-28','delivered','LE7526936812','Sheikhupura',190,'seed'),
('s93','2026-02-28','delivered','LE7526936814','DG Khan',190,'seed'),
('s94','2026-02-28','pending','LE7526936815','Peshawar',190,'seed'),
('s95','2026-02-28','pending','LE7526936816','Kotli',190,'seed'),
('s96','2026-02-28','delivered','LE7526936817','Lahore',190,'seed'),
('s97','2026-02-28','delivered','LE7526936818','Hyderabad',190,'seed'),
('s98','2026-02-28','delivered','LE7526936819','Mirpurkhas',190,'seed'),
('s99','2026-02-28','inTransit','LE7526936821','Islamabad',190,'seed'),
('s100','2026-02-28','delivered','LE7526936822','Sheikhupura',190,'seed'),
('s101','2026-02-28','delivered','LE7526936823','Karachi',190,'seed'),
('s102','2026-02-28','delivered','LE7526936825','Karachi',190,'seed'),
('s103','2026-02-28','inTransit','LE7526936831','Rawalpindi',190,'seed'),
('s104','2026-03-03','pending','LE7530406239','Shahkot',190,'seed'),
('s105','2026-03-03','pending','LE7530406241','Faisalabad',190,'seed'),
('s106','2026-03-03','inTransit','LE7530406242','Quetta',190,'seed'),
('s107','2026-03-03','delivered','LE7530406244','Haroonabad',190,'seed'),
('s108','2026-03-03','delivered','LE7530406247','Karachi',190,'seed'),
('s109','2026-03-03','delivered','LE7530406248','Kamber Ali Khan',190,'seed'),
('s110','2026-03-03','pending','LE7530406249','Karachi',190,'seed'),
('s111','2026-03-03','delivered','LE7530406250','Lahore',190,'seed'),
('s112','2026-03-03','delivered','LE7530406266','Khairpur',190,'seed'),
('s113','2026-03-03','delivered','LE7530406288','Hyderabad',190,'seed'),
('s114','2026-03-03','delivered','LE7530406290','Okara',190,'seed'),
('s115','2026-03-03','pending','LE7530406291','Dahranwala',190,'seed'),
('s116','2026-03-03','delivered','LE7530406352','Wazirabad',190,'seed'),
('s117','2026-03-03','delivered','LE7530406691','Gujrat',190,'seed')
on conflict (id) do nothing;

-- Seed ad spend
insert into ad_spend (id, date, pkr, gbp, note, source) values
('a1','2026-01-25',3453,9.73,'TikTok — Jan 25 batch','seed'),
('a2','2026-01-29',3453,9.73,'TikTok — Jan 29 batch','seed'),
('a3','2026-02-02',6907,19.46,'TikTok — Feb 2 batch','seed'),
('a4','2026-02-04',3453,9.73,'TikTok — Feb 4 batch','seed'),
('a5','2026-02-14',6907,19.46,'TikTok — Feb 14 batch','seed'),
('a6','2026-02-19',3453,9.73,'TikTok — Feb 19 batch','seed'),
('a7','2026-02-21',3453,9.73,'TikTok — Feb 21 batch','seed'),
('a8','2026-02-28',3453,9.73,'TikTok — Feb 28 batch','seed'),
('a9','2026-03-03',3558,10.03,'TikTok — Mar 3 batch','seed'),
('a10','2026-03-10',6000,0,'TikTok — Mar 7-10 (1500/day x4)','seed')
on conflict (id) do nothing;

-- Seed payments
insert into payments (id, date, amount, note, source) values
('p1','2026-01-31',1358,'SI-7212','seed'),
('p2','2026-02-04',3565,'SI-7300','seed'),
('p3','2026-02-07',3425,'SI-7371','seed'),
('p4','2026-02-11',266,'SI-7455 (high returns)','seed'),
('p5','2026-02-14',2946,'SI-7547','seed'),
('p6','2026-02-18',3665,'SI-7624','seed'),
('p7','2026-02-21',5972,'SI-7662','seed'),
('p8','2026-02-25',4424,'SI-7750','seed'),
('p9','2026-02-28',1463,'SI-7807 (high returns)','seed')
on conflict (id) do nothing;
