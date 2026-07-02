**Call with Danny and 4 others-20260605\_091052-Meeting Recording**

June 5, 2026, 2:10PM

54m 9s

**Amith Nagarajan** started transcription

**Amith Nagarajan** 0:04\
Alright, Daniel, recording this for you. I\'m gonna share my screen.\
All right.\
So I thought I would start off by taking a look at the database schema.\
So, let me zoom in here. So, actually, first of all, a quick review: we
have Biz Apps Thomas in here, which is pretty straightforward. So, Biz
Apps Thomas, zoom in here.\
Actually, at the old school, this one, this is a for you, actually, this
time, cool.\
Alright, so Biz Apps common is kind of hard to read, isn\'t it?\
Yeah, see this kind of clipping off, except the prefix that\'s clipping
off the rest of it. It\'s on the right. Oh yeah, yeah, that\'s that
works. What I really just want to show here is in this biz apps, Tom,
you have people and then you have organizations and we\'re going to be
building up on top of that. So right now we have in.\
In Blue Cypress, in our database, we have like a custom table, set of
tables, like CRM contact and CRM organization, I believe, is that right?
Or something similar? Account. CRM account. CRM contact. Yes. So it\'s
counting contact. So the account table is going to get migrated over to
this.\
organization table and the idea of contacts is going to get migrated to
the biz apps top and people table. So when we move over to this new
system from Blue Cypress, it\'s going to be like a data migration that
we\'ll do and then we\'ll set it up into the environment.\
So that\'s the basic idea is like we have those people and companies and
those are essentially for purposes of like what we\'re going to do up
the stack, we talk about accounting and other entity, we\'re going to be
something our customers. So the accounts or what we call organizations,
that\'s like the associations we sell to and then the contacts. Sorry,
where is the contacts? Will that be an opportunity to glean the data?\
What\'s that? Will we want to take an opportunity to clean the data,
update the data, or just take it over? There\'s probably some things
we\'ll want to do to, you know, get rid of some garbage that\'s in there
and not bring over things that are, you know, or like bad out of the
data. Cool things or whatever, yeah. Yeah, stuff like that would be nice
to clean over or bring over. So that\'s just apps common. And then the
layer above that is this apps counting.\
So, same right here.\
And what I want to find here is the core of this is\...\
Still.\
chart of accounts mapping.\
No, I\'m just gonna show you guys a different screen. I thought this
would be kind of the show in the app, but I\'m just gonna do this side,
yes.\
Okay, so inside Bus Apps accounting, the master plan, this is in the
repo. I can go over the entity model here. The concept is, I just went
over the dependency stack. The other thing I want to point out is
borders. So this is really the probably easiest field to walk through
this. We have this concept of\
Where is it? GL account. Here we go. So GL account in this environment
does not need to be the universe of all possible GL accounts. It can be,
but it doesn\'t need to be. It\'s essentially like things that are
relevant to selling stuff and collecting cash. So typically it would be
like, you know.\
Cash receivables, it would be revenue accounts, it would be, you know,
accounts on revenue, and we don\'t really do this, but like inventory
cost to be sold, those kinds of accounts will be in the mix. For you
guys, just a really quick concept is that, like the background in two
seconds is that accounting systems use these accounts to basically track
the flow of amounts of money.\
essentially in and out of things. They\'re not really like bank
accounts, they\'re just basically like an internal way of tracking like
different values, like how much revenue have you brought in or how much
have you spent on certain expenses or, you know, and there are accounts
that map to like what you guys think of accounts in the bank, like cash
accounts, things like that. One of the most confusing things about
double entry bookkeeping is the idea of the term debited.\
credit, which is not the scope of this conversation. The easy way to
think of this is debit means left side, credit means right side. It does
not mean plus or minus. Because the confusing part of accounting is that
account type determines whether it\'s a debit account or a credit
account. So for example, asset accounts, when you debit them, sounds
like they go down, but they don\'t.\
crediting the account actually decreases the value of an asset account,
whereas that is not true for revenue accounts. So revenue liability,
equity is the other side. So it\'s very confusing sounding. You guys
have a resource that you can check out later, like just background, and
I would zip through the first couple modules so that you\'ll understand
this a lot better.\
But GL account here maps to the chart of accounts concepts that you\'ll
learn about when you say that those one or two seconds. Is this, would
this be the right spot to have our full GL account array, which is
standardized across entities for future build purposes? You could, and
we\'ll synchronize this with Business Central. So we could just suck it
all over. It doesn\'t really hurt anything to have it all there.\
And we do support dimensions in this design as well. So one of the
things we can consider is, especially with the stuff we were talking
about yesterday, is a radical simplification of everything, right? When
we\'re talking about, you know, do we have like, has our GL, has our
chart accounts like exploded out in terms of the number of national
accounts we have in the system?\
and could potentially simplify that and use dimensions more. Also,
because we\'re going to have a really powerful, you know, AR subsidiary
ledger record here, which has a very deep product catalog with all sorts
of rich dimensionality there. You know, do we really lean on the GL more
for really high level stuff? Like the GL is like, we\'re going to want
to look at it and say, hey, what do you want in the, what do you want
the financial statements to look like? So you want your P&L to be able
to break out.\
We need the financial system to be able to break it out and have like a
whole bunch of subcategories. Okay, fine, like we want to do
departmental P&Ls, which we probably do, then we need dimensions for
that, but for like, like the things that people start using dimensions
for an accounting system that I disagree with would be like customer
segment, customer type, and you don\'t really do P&Ls on that basis,
it\'s more analytics.\
the analytics stays over on this side. So GL accounts are kind of the
central part of this. And then what happens is, is that there\'s this
concept called journal entry, and then journal entry line and journal
entry line dimension. And what this is, is essentially, as other systems
are\...\
doing work, they\'ll generate journal entries. So this is part of what
we\'re talking about next year, Jeremy. You have the concept of like the
order, and so further up the stack here in biz apps orders, you have
orders and you have payments. In the order entry system, when you sell
something, you\'re going to have.\
So the way I typically design this is you\'re going to have a debit to
AR, always. You have debit and cash, you literally got to check in like
in the mail. So we always debit AR on the order side of the house. And
then the rationale for that is just to have consistency. So, and then on
the payment side of the house, we have an order record and we have a
payment record.\
If there is no payment, then give a debit to AR and give a credit to
Redmond. So in the simplest possible thing, right? We ship the product,
it\'s off the door, it\'s red rack. So you have debit AR, credit, sales.
And that\'s the order side. So the order would generate a journal entry
that has two journal entry line items, debit AR.\
Credit sales right now, which sales account do you credit? That\'s
determined by the product catalog. So, over here in BizApps orders, we
have a product table, and that product table is the central source of
truth on all the products we sell. Now, products will be linked to
companies, so MJ has the concept of company, which is like department,
division, subsidiary, it\'s like org chart.\
So each of our companies that have products, like for example, Izzy,
will have a product problem called Izzy. And in the Izzy products, if
there is a separate, like at the moment, Izzy\'s not a separate company.
So Izzy could go to like a SaaS revenue generic account, but then it\'ll
have a dimension on the product attached to it, which would be like for
the Izzy department, right?\
If we broke it out later and it\'s its own company, then we would have
that contributed as well. So the product catalog defines kind of the
setup of how does the order entry system know to generate a journal
entry to credit a particular sales account and to use a particular
dimension on the journal entry line item. That\'s how.\
Is from the product catalog, and that\'s consistent with how the AIDP is
set up today. Is that right? Yeah, OK. So, everything, yeah, on a
contract basis. OK, cool. If there\'s tiers of a product, is those like
separate products in the system, or is it like a subdivision of the
product? Great question. I haven\'t gotten super deep into the
definition of\...\
the products that I really want to make the products multi-dimensional
as well and kind of arbitrarily do that because we do have, so the
shorter version would be want some kind of a top level product that is
it, and then you might have like, you know, the basic plan, the premium
plan, or for MJC, you have the same concept of like different levels.\
Those typically wouldn\'t be different products, and from the accounting
system, they would typically all flow to the same revenue account. The
only reason you might flow it to a different account in the accounting
system is if you wanted the accounting system to be able to produce a
different financial statement, which typically isn\'t where you do that
kind of analytics. You typically do that kind of analytics more from
like, you know, the MJ side, where you\...\
You know, build a report that shows you revenue by signals or, you know,
by tier. Oh, no, yeah.\
It\'s actually pretty simple. Orders generate journal entries. So orders
create these journal entries, right? And then journal entries have two
or more lines. They always have to have two lines, by the way. You
can\'t debit something and not credit something else. That\'s why they
call it double entry bookkeeping. It makes it extra fun. It should
double, twice, twice, twice.\
Yeah, so, so, and some things, if they\'re intercompany, we have to have
four, because you have to have a balance set on Company A and a balance
set for Company B, but always even, and, and always that, like, yeah, if
it\'s not in one account, it\'s gonna be another, which is nice, like,
these are easy deterministic rules, right? It\'s like something\'s
wrong.\
Okay. And GL accounts will be tied to accounting company profile. So
accounting company profile is an extension of a company. So there\'s
company table in Core MJ. And what we\'re going to do is we\'re going to
use some is modeling features. Are you guys familiar with that? So the
is a modeling features allows us to essentially extend the company
table.\
And the accounting company profile table is a company means that it\'s
an extension of the company table. So it\'s going to have additional
attributes like what\'s the organization type, what\'s the tax filing
status, stuff that\'s not in the company table that we wouldn\'t care
about. And then the GL accounts will all attach to a particular company.
So if you have multiple different companies, then\...\
There\'s different charts of accounts for each company, essentially.
Okay, so now we have a standardized chart of accounts, so I don\'t know
if it would be simpler to use numbers and they map. They might have a
slightly different name. We will still, from our purposes in the system,
we\'re going to still consider them separate GL accounts, separate
records in the GL account table, because we need to know like which
company it\'s, even if it\'s the exact same number. Yeah.\
He needs to know its GL account, like, you know, so Izzy has, like, what
he\'s talking about is this intercompany scenarios, or what I\'m
referring to as intercompany stuff, where let\'s say I have a deal where
Ben Lee gets him a phone and he sells \$100,000 of Izzy, but he also
sells a \$20,000 Sidecar subscription. So what happens there is you have
a debit to accounts receivable.\
But actually, it\'s two different debits, the two different accounts
receivables, and then you have credits to the because there\'s different
companies. So, Izzy\'s one company, sidecar\'s another company. So, each
of those companies is a separate parallel set of books and you\'re
debiting AR on the sidebar side for 20 grand, you\'re debiting AR on the
Blue Cypress Izzy size for 100K in my example transaction.\
Then on the credit side, you\'re crediting revenue, or actually
crediting in this case, it\'s even more complex because let\'s just say
those products are like not subscriptions, there\'s one time delivery
and when we sent the product out, you\'re just crediting revenue. But
revenue, part of the revenue goes to the Izzy, part of the revenue goes
to a different company. Okay, so that\'s, now you have a journal entry
that actually contains.\
multi-company parts to it. So that actually gets very interesting when
you batch it, because when you batch it, you have to basically separate
it out because the companies and the GL are separated. Or actually, does
Business Central have the smarts to be able to have composite journal
entries that auto-post across to different entities or no?\
No, that\'s for that. We need Claude to send them in, but they would
each one and book. It\'s possible that God has to do it though. I mean,
it\'s good, like, you know, there\'s not, we\'ll talk about in a minute,
but we\'re gonna fix that. So, what happens is that a journal entry can
contain lines, and the lines are trivial to a specific VL account.\
If a journal entry has, you know, like multiple different companies in
it, we have the ability to do composite journal entries that are for any
number of companies that we have. When we batch these things, so
batching is this process where later on, it could be the end of the day,
it could be the end of the week, it could be the end of the month, I
would encourage us to do it at least weekly, possibly daily.\
It\'s just easier when you have small groups. Let\'s say you have 100
orders, you know, so Ben sold a bunch of stuff, Sofi stuff, we sold
stuff, we sold a bunch of stuff that day. So what we want to do is we
want to update the accounting system. So how do we do that? So this is
an integration. You might say, oh, well, we use the integration
connector. And we could. The problem is, is that integration connector
is designed to basically just pass data back and forth.\
We need a process for this kind of integration. So when you integrate
financial systems, you want to be able to have proof of where the data
came from. This is a really key concept that most of these types of
systems do not have. And it\'s one of their major flaws because you do
not, once you post it and like the counter system.\
Like, where the hell did that transaction come from? And you go back and
go, oh, okay, well, I had these summary entries and I go back and like
the source system, it\'s not there anymore. Someone changed it. Does
that ever happen to you? Yeah, it sucks. And then accountants spend
their time basically chasing their tail over this \*\*\*\*, like a third
of their lives or whatever. It\'s just terrible.\
So, we think it\'s even more fun when the auditor finds that stuff, and
Kevin really has to go and chase the people to figure it out.\
So, this type of accounting system is really good if you want to have
things buttoned up. So here\'s how this works. So there\'s this thing
called journal entry batch. Journal entry batch, you can create them
whenever you want. And you batch up a bunch of journal entries. And the
journal entry batch basically grabs all of the journal entry lines and
it aggregates them up.\
It looks like there\'s a missing thing here, because journal entry
batches need to have their own lines. We\'ll come back and fix that,
obviously. But basically, like, let\'s say you had 100 different
transactions and they had a bunch of different debits and credits. You
would essentially group them up and group them by account. So in the
summary entry, in the journal entry, in the summary.\
A batch, if you had 10 debits to the same account, you\'d have one
debit; that\'s the sum of those amounts, so it makes sense too, so it\'s
pretty straightforward. Now, here\'s the key: once we send that batch
over to Business Central, we lock the data, so a big part of what needs
to be built into this BizApps accounting app.\
is system level, very hardened controls down at the DB level that
enforce these rules. So once the batch has a status of exported or
locked or whatever we call it, at that point, we lock down the journal
entries. And then the related systems have to be responsible for locking
themselves down.\
So for example, if I had an order over here that generated a journal
entry, the order entry system has to be smart, where it knows that the
batch for its journal entries have been locked, so it\'ll be responsible
for ensuring the order data doesn\'t get changed as well. So it\'s like
in\...\
I don\'t know if this is your case in accounting class, but I always
said we stuff in pen by hand. So it was like the point of it was you
never want to use pencil because you\'re not erasing things. You\'re
doing adjusting entries, right? And so like, get us out. Yes. So
accountants love pen, not pencil.\
They should, and but they may not love it, but that\'s important because
you want to be able to trace everything back, so it\'s kind of like a
blockchain principle, but without the scammy part. No, they can be
scammy parts, that\'s true. NRI doesn\'t have blockchain, and they they
did a pretty big job with their scam.\
But then the whole idea of the batching is like your general ledger
doesn\'t have all the details. It doesn\'t have every journal entry for
every order. It\'s the summary of it. But then it has the link back to
the detail or the subledger. The subledger has all the details. Right.
And so the journal entry batch contains all these journal entries which
have journal entry lines.\
When you\'re talking about like seeing where the data actually like
comes from, where the transactions come from, which entity is that
stored in? It comes from multiple different sources essentially, so it
could be any system. So any system like so the BizApps accounting is the
core journal management system. It\'s just journal entries, recurring
journal entry templates, chart of account stuff.\
It\'s the basic core concepts, and then we have some aggregation tables
here, by the way, that capture like snapshots of balances. I actually
think I might kill this for the first version, but then you have apps on
top of the accounting system that generate general entries. So, in the
order entry system, here is what we\'re doing: order entry system. This
is a process where\...\
I sell Robert, you know, a pen and he promises to pay me. So, in
accounting speak, that would be a receivable because I have an asset on
my balance sheet which says that Robert owes me a dollar. Robert, at his
end, if he\'s keeping good books, he has a liability on his balance
sheet that says he owes me a dollar. I have sold him a product, which
means that I have\...\
Revenue of the dollar, right? And then he has received possibly an
asset, or he could just consider it an expense. If it\'s something
trivial like that, probably expensive, and he would have an expense. So,
on his side, which I don\'t care about since the customer, but like the
customer would, the customer would get an expense and credit, credit, a
liability, because he owes me money.\
Now, that\'s just because you shake my hand and say, \"I\'m gonna pay
you later. That later might be in five seconds, or it might be in never,
or it might be, you know, whenever. So, that\'s called a receivable.
It\'s basically like an IOU right now. That\'s the order side, always
goes through receivables. It never it never touches cash directly. Now,
the customer, when they pay us, payment side also\...\
generates journal entries. And what does the payment do? It basically
debits cash accounts. So now Robert sent me a check for a dollar, I
deposit it in my bank, so I debit cash for a dollar, and I credit the
receivable. So the receivable is an asset account. So when I credit it,
the value goes down, which is the confusing part for most people in
terms of normal language.\
By the way, the reason your bank statement says that you get credits is
you\'re not an asset to them, you\'re a liability.\
So to them, they owe you money. So when the bank balance goes up,
you\'re getting a credit. That\'s why, like, we call it that, right? So
banks, since you\'re a liability then, just they don\'t get covered. So,
good fun. The data will, in practical terms, become from HubSpot and
Stripe.\
in terms of where the orders need to come from. In today\'s right from
an accounting perspective, we don\'t really know about that until the
cash hits the bank. And a lot of times we\'re skipping the cash
receivable step, but we want to add that in. We are doing that for some,
but not all. When we say the data comes from, so you\'re talking about
like what\'s in the order?\
Or are you talking about that? Well, I\'m thinking about how will the
system know that there\'s an order? So we\'re going to have an order
entry system in here, which is where the orders will be put in. That
could be coming in through MCP, through API, through a human entering
it. But today it\'s coming from, if we were to build it just as with
today\'s order flow, is it appropriate to say that that data was coming
from HubSpot?\
Yeah, that goes to play. Okay. In this system, so you\'re not going to
go live with just the accounting module. So if we just took the
accounting module and went live with it, we\'d have to do what you\'re
talking about and say HubSpot and all of its shittiness and then flow it
through the accounting system and it would be terrible. So we\'re not
going to go through that pain. We\'re going to wait until we have the
order entry system.\
And in the order entry system, we are going to have our own book of
orders. So we have product catalog, order entry system, which is orders,
and payments. And we are the originator. We are the source of truth. We
are the originator of the transaction in our system. So A salesperson
goes, it signs a contract, and it gets into the order system. It gets
into the order system.\
The way it gets in there probably will be HubSpot opportunity will
trigger our workflow where we will create the order automatically. And
then most likely initially, or maybe maybe forever, accounting reviews
it and marks it as approved or whatever. And when it\'s approved, then
other things happen. Okay. Does that make sense? Yep. So the order entry
system, the source of truth becomes Blue Cypress, so this accounting
system. So orders generate.\
Journal entries, that\'s what those are. Orders will have things.
There\'s a whole bunch of detail not shown in here, but orders, order
lines, which is like the line items of the order, and so on and so
forth. And then payments, again, payments are interesting because when
we talk about multi-company, which we do deal with, I think, pretty
regularly, right? Multi-company payments, so the invoices typically go
out.\
From one company, so can we pay people like pay us in aggregate for
multiple companies? OK, this will start happening a lot as we go forward
with the new operating level stuff that we\'re talking about, but so
let\'s say, let\'s say I had my earlier example of a \$100,000 Izzy
sale, \$20,000 sidecar sale. You know, Ben being the sales guy that he
is just throws it over the fence and\...\
goes off on its merry wedding. And meanwhile, accounting has to deal
with that. So what accounting does is it has an order and the order
debits AR for both companies and credits sales for both companies.
Because I\'m making it simpler. We\'re going to talk about another
concept called deferred income in a second, but just to assume that
these types of products were like not subscriptions.\
Okay, so in that scenario, now let\'s say 30 days later, the customer
pays us. They send us a check for 120K. Now the check comes in. Where
does the check go? When you deposit a check, where do you, how do you
go? When you go to the bank, when you deposit a check?\
You put it in one account, you put it in multiple accounts, typically,
and multiple, I need to split it.\
You usually split it? Yeah, like, I\'ll be like, if I like going to the
person and be like, I want this much investment, OK? So, bad example,
yeah, I get what you\'re saying. Actually, yeah, in that case, the bank
internally is actually doing what we\'re about to say, but like,
basically, the cash receipt goes into your single business, so \$120,000
check.\
can\'t be received by multiple companies. So you can\'t have like, you
can\'t have Blue Cypress Inc. and Sidecar LLC both receive the \$120,000
check. The check was made out to one or the other. So if it\'s made out
to Blue Cypress, it gets deposited into Blue Cypress\'s bank account.
And Sidecar\'s a separate business.\
So let\'s just say Izzy is part of the Blue Cypress system right now. So
\$100,000 of that was owed to Blue Cypress and Izzy, but 20,000 wasn\'t.
So we have to deal for that. Then we have to deal with that. Now up
until that moment in time when we deposited the 120,000, we actually had
two separate receivables. We had a receivable of AR in Izzy Land.\
For 100K, and a separate 20,000 in the world of Cypod, which are
separate companies. Does that make sense? Yeah. Now, once we go in and
get a payment, Blue Cypress has got \$120,000, so we\'re going to debit
cash for \$120,000, and we\'re going to credit accounts receivable for
100,000.\
But we have \$20,000 more than we got, which, you know, we\'re like,
this is great. But unfortunately, looks like this wants to pay that 20
grand to boot. Correct. So it\'s a liability. So there\'s something
called intercompany balancing entries. And we\'re going to generate them
automatically in the payment system.\
So the payment system will know that the payment was received by and
deposited into a payment type or an account that is owned by a
particular company. And then it will know based on that, okay, well, the
orders that were paid off, the products on those orders, and all of that
is the details of the order entry system. What\'s the allocation?\
how much, if this is 100%, this one company, there\'s another company
balance. The answer is done. But in this case, it\'s going to be, it\'s
going to create another pair of journal entries. It\'s going to create a
debit to an asset on the sidecar side. Sidecar side is going to have a
different receivable. It\'s called a due from. A due from account is a
receivable on the sidecar side.\
And so that means sidecar is owed money from another company in the fan
or another, either another sibling business or some other related
entity, essentially. So it\'s just like any other receivable would,
it\'s owed from a related business, essentially. But you typically
segregate that out in the accounting system. You don\'t have that in the
state. There\'s no like one giant accounts receivable, typically.\
treated differently. And then on the Blue Cypress side, we do the
opposite. So there we have something called due to, and due to means we
owe money to someone else. So Blue Cypress will have a liability account
called due to, and you\'ll have these pairings where there\'ll be due to
due from pairs in the general with, or sorry, the general ledger chart
accounts for each combination of possible companies that have had.\
transactions. So you\'ll have a due to sidecar of \$20,000, and that
will get credited for 20K, which means that liability goes up. So you
credit AR for 100,000, which means AR goes down by 100 grand, and you
credit due to sidecar for 20 grand, which means now we have a new
liability on the balance sheet when Cypress.\
And then on the balance sheet of Sidecar, you have \$20,000 asset. Does
that make sense? Now later on, at some point, Blue Cypress is a very
benevolent dictator. So Blue Cypress says, we will actually pay our
subsidiary Sidecar because John complained about it. And as he usually
does. And so then Blue Cypress transfers 20 grand from Blue Cypress bank
account to the other account.\
So here\'s what happens. Now you wash it out, right? So now Sidecar
Books, you have a debit to what? When Sidecar received the cash. Debit
to annual agreement? They are? No, cash, because you\'ve got cash. So
you cash one up. So you debit cash, this is where it gets confusing. And
then you credit due from Blue Side Group.\
because BlueCypress no longer owes sidecar anything. So now the D from
is gone, but cash has gone up. Now, what happens also in sidecar line is
it has a receivable that had to wash out of the payment, which I didn\'t
mention, but that\'s also done. So right now you do this all manually if
you have an intercompany. We do, and you were talking about having\...\
Blue Cypress headquarters be involved, but if it\'s ever between 2
subsidiaries, it used to get messy because it would be intermingled. So
today we either invoice, so there\'s an actual invoice to track it, or
everything runs through the hub of Blue Cypress. So if all that goes
away, yeah, so I think all this would be an improvement, but today
we\'re making.\
Right, Blue Cypress, even if Blue Cypress isn\'t involved in the
transaction, if it\'s between Sidecar and Betty Bottom, is gonna flow.
We\'ll do it way more organically now, so, and this, and the
intercompany bouncing entries on a per transaction basis are a pain in
the \*\*\* to deal with, and so accounts typically don\'t manually do
this, they\'ll like do kind of at the end of the month, and you know,
hopefully it\'s right, and so it\'s there\'s all sorts of approaches to
this.\
This is the only one that\'s provable, because you can go back to the
source transaction and say, I know exactly why this is the case. So
that\'s the payment side. The last thing I want to cover real quick is
conferred revenue. So what do we have here? Where is this thing?\
Uh, this is, oh, it\'s not showing summaries probably later on. Should
be a table called Scheduled Transaction, uh, Scheduled Journal,
Scheduled Journal Entry, actually, I think it\'s been installed.\
I want to show about mapping as well. Sure.\
That\'s a different thing. You know what, Claude changed my thing.
That\'s what this is. So we decide currency going in accounting instead
of is that common? Or is that? Yes. Okay. Yeah, we\'re going to put it.
It\'s right here. So actually I have a note in here. It now lives in
accounting. And the rationale for that was I originally thought maybe
common was a good place for it because it\'s.\
Something that could be used in other non-accounting applications, and
then again, BizApps accounting is a it\'s a free open source app, so
it\'s installing, you know, yeah, so OK.\
I think it\'s reasonable to have it here. So I need to update the design
because we don\'t have this, but we have journal entry, we\'re gonna
have something called scheduled journal entry. So let\'s talk about the
theory of revenue recognition for a minute. I\'ll say a couple words and
Jeremy jump in if you want to add more color, but when you sell
something.\
You, some things are simple, like I sell you this bottle and you receive
it. I have transferred value to you. Transaction starts, ends,
instantly, right? So therefore there is a receipt of cash or there\'s an
AR and then there\'s revenue. Revenue means you\'ve earned the income.\
But in some situations, you don\'t deliver value.\
So, I\'ll give you an example: Digital Now is coming up in October,
right? And we\'re selling tickets to the Digital Now right now, and so
people go online and they pay us, what is it, John, \$1000, 900 bucks,
some of that. Yeah, so it\'s like, yeah, somewhere in that neighborhood
they pay us money ahead of time. So, over the course of the months
we\'ve seen the Digital Now, we collect.\
all the revenue from the ticket sales, digital net, right? Probably
expect 300 people, something like that. So, got all this cash, have you
earned it yet?\
Yeah, you haven\'t done it, right? So you just sat on or done so far
from the customer\'s perspective, but we plan the event and we\'re doing
all this work, but they don\'t care because they receive 0 value. So
now, once we go to digital now and we have October 25th through 28th
occurs, end of that month, we\'ve completed the event, right? So now,
how much value of\...\
be delivered. All of, correct. So this is called a one-time deferral,
right? So what you do is if I sell you a ticket digital now today, I
wouldn\'t credit sales or revenue account, I would credit a liability
account called deferred, or deferred revenue deferred income. It means
the same thing. So then there\'s no revenue.\
But the revenue happens later once you earn it. Does that make sense for
the concept? Yeah, it\'s to defer revenues always have like a set date
of when they actually get like completed. That\'s one type. There are
other categories. There\'s actually all sorts of flavors of this. It
gets really fun. The most common two are single date deferred when we
have an event, an event type thing, and it\'s a known date like that.
And associations and for us, it\'s common to do that.\
And the other category is a schedule, where a subscription. We sell a
subscription. So I sell, you know, Jeremy MJC subscription. It\'s \$120
for the year. He pays it all up front. And we have, we don\'t need to
wait till the end of the year to recognize it, but we recognize
typically pro rata.\
over the course of the year. And this is where scheduled journal entry
comes into play. When the process of creating all this stuff happens, we
will generate 12 scheduled journal entries. If it\'s a subscription
product set up with a monthly rev rec cycle. So these are all.\
flags that are set at the product level. So you specify if the product
was a subscription or not, you specify those red rack cycle is, is it
monthly, orderly, whatever. So if it says like, okay, so monthly,
monthly red rack, then it will generate 12 scheduled journal entries and
they\'re at the end of each accounting period starting with the period
that the subscription begins. And the subscription may actually have a
future start date. So it then succumbs to customer pressure and says,
I\'ll.\
I\'ll let you start your busy subscription on July 1st, and you know you
signed it today, which he does all the time. If he does that and he
signs the transaction now and the customer pays, when does the revenue
start getting recognized? If the subscription doesn\'t start until July
1st, until July 1st, right? Exactly. It\'s because when the theory of it
is very simple. In Gatton County, you have to basically recognize
revenue and the value has been.\
free to the customer. And then our subscription management system, which
is, I haven\'t gone over that, but that\'s a very important part of Biz
Apps Orders, because these days almost everything\'s a subscription. So
there\'s a subscription primitive inside Biz Apps Orders. This is the
thing that tracks like individual subscriptions that are out there.\
Subscriptions will have terms, they\'ll have renewals, they\'ll have
cancellations. Every time a subscription term fires up, basically you
have this like, you know, essentially like this waterfall of journal
entries that come with it. And so in this particular case, those journal
entries are tied to the subscription term, which is what generated the
journal entries. I think that\'s how we used to do it anyway.\
That\'s probably what we\'ll do here. So that\'s the concept. So the
most common ones you\'re going to deal with are this cascade or
waterfall of journal entries that are like an even amount over 12
months. If the amount is uneven, then you have to typically at the last
month you\'ll pick up like extra pennies or whatever to make it
disaster.\
Yeah, we flipped it. We actually put all the extra in the first one.\
It\'s like, why wait till the end? That\'s only, you know, we\'ll take
that then. We\'ll do the rounding, do the rounding up front. Yeah, I
like that. When it starts on the 1st, it\'s pretty straightforward as to
what the month array is right from July 1st to June 30th, but when it
starts on the 15th or the 30th, currently we are recording a full month
of revenue. We are agnostic as to the date. We say it starts on July and
we get the 12th.\
We have a 12 month, we have 12th in July, and that often means that we
have a tail where a subscription is through July 29th, but we get no
revenue in that month because it was fully exhausted in June because we
got a full month on the 1st July. So we just need to decide if that\'s
consistent. I think that\'s reasonable. I don\'t think that you need to
parse it further than that. I think that, you know, if it starts at, I
mean, if it started on July 31st, you know, and.\
You might think it like start day, like the start of the month, not the
end of the month, right? Like, that\'s the that\'s the way I look at it.
I think it\'s reasonable to do that, but I just wanna make sure we\'re
agreed. I don\'t think it\'s that big of a deal. I don\'t think you need
the down of the day, \'cause, like, if what he\'s talking about here is
like the alternative to that, if it starts on July 15th, you recognize
50% of the subscription.\
For that 50% of that month at the end of July, and then the other 50% of
that back half on the, like, you know, on the next July, but I think
our, I think our system should support that, and so actually this is a
special note for our friend Claude, who will be later reading this
transcript. We want to add the functionality of the subscription
management system to support all these different methodologies. So, on a
per product basis, we\'ll have configuration.\
to control, obviously, the subscription\'s default frequency, but on a
per subscription basis, we\'ll then have the rules defined to determine
if there\'s any interrupt period rev rack necessary if we have an uneven
start date that\'s outside of the boundary of the accounted period. It
can get a bit, we\'ve seen some edge cases where the renewal.\
Maybe the existing one is set to stop on June 29th, but the renewal
doesn\'t start until July 1. Right. And so in that case, we end up
missing a month of where there\'s a blip over time. It\'s the same with
the full amount of revenue, but you missed a month. We\'ll just have to
maybe there\'s a flag where a renewal.\
Of.\
has to pick up the lead the first gap month. I don\'t know if that\'s.
Well, and that\'s like there\'s kind of a question in the business rule.
Do we allow the customer to review with a gap? Or is it considered a new
subscription and therefore they don\'t get the benefit of carrying
forward whatever their legacy pricing was? My answer would generally be
at a business level, I don\'t allow the customer to have any lapse
whatsoever.\
So they always will recede from where they last ended. But there\'s
exceptions in all sorts of scenarios. So in that scenario, if you were
doing the no intra-period rev rack rule, which I just said, like, you
don\'t care what day of the month it is, then it wouldn\'t matter. But
let\'s just widen that gap further and say they ended in May and then
the next first started in July. In that case, you would miss June. And
so the subscription management system would automatically happen.\
Handle that, because you\'d have the rev rack, the last rev rack, the
last scheduled journal entry for the prior subscription term would be
the May one, and then the first scheduled journal entry of the next
subscription term would be July, so you just automatically get that
behavior, so you missed it, and then it just makes me scratch my head
while I whatever.\
Wherever it goes down for a month, it pops up every once in a while.
It\'s like, yeah, when the why did that happen? Well, you\'ll be able to
trace it, so if you look at that and you\'re looking at like, okay,
well, why is such a case? The beauty of this is you\'ll be able to like
literally click down and see exactly what it is and look at the
subscription, go, okay, there was a gap in the renewal and normally we
don\'t allow that, but in this case, you know, the customer.\
It spends a lot of money from us, and there was a weird circumstance in
the allowing, but cool. So, and the other time that this flips a little
bit, it\'s the, I think, more of a UI issue where we\'re seeing a GMT
time versus a central time and something is in the thirty-first and one
time zone, but the 1st and another time zone, so we\'re gonna just
finish there.\
Well, we use standard, we we use Zulu Time GMT for everything, so, but I
think that that\'s easy to resolve. I think I think that I mean, what we
can we can just fix it with Central Time, you know, it\'s like all the
day all the day time is like in the system or stored and standard is
there. I think that would actually be a good thing to deliver the system
too is like for the business, like you know what?\
What time, yeah, time zone in, yep, per day, you know, so, like, yes,
everything\'s in Zulu, but it translates the company into that. Just
another note for Claude is that in the Biz Apps accounting on the
accounting company profile, saying we want to track the company\'s
operating time zone for and stuff like that. Cool, so\...\
With respect to payments, subscriptions, and orders, each of these are
originators of journal entries, right? So we\'ve talked about actually
further up the stack, but the essence of what we\'re talking about right
now is building the core like processing engine for journal entries,
which is actually, it\'s the simplest part of the whole stack. It\'s it
needs to be really, really strong because it can\'t like.\
For example, once this order has been closed or marked as marked as
closed, it cannot, its journal entries can no longer be modified, right?
So there\'s a bunch of constraints and rules. They have to be enforced
all the way down at the database level. So in the design, they\'re
actually, it already talks about this through triggers. So the reason
you do it through triggers and you have to ensure that it\'s
guaranteed.\
Is that if you do it through a stored procedure, where you like say,
\"SP update, SP delete, run person visits rules, and if someone has
elevated privilege, which goes and inserts or updates in the table, they
can bypass that, but if you do the trigger, you can throw an exception
essentially, if you\'re not allowing that transaction to occur, right?
So there\'s things we can do at that level, and then we, excuse me\...\
We will also build those same business rules and we\'ll bubble them up
into business objects so that we have a higher order catch where we
won\'t allow that. And then we\'ll bubble it all the way up into the UI
so that the UI will like be grayed out and logs and all that. So that\'s
what we\'re going to focus on is building out this accounting
functionality. And then as soon as we get that done, we\'ll review it,
we\'ll do a demo. There\'s actually won\'t be much of A demo. These
essentially what we\'ll have is like a simple UI to like review journal
entries. We\'ll throw some.\
mock journal entries in the system and we\'ll show you how batching
works and we\'ll build the integration between this and Business
Central. So like automatically batch, we\'ll build the integration to
suck in the data from Business Central for charted accounts. So this is
actually probably a good separation of duties like one of you guys could
work on that Business Central integration that everyone could start
working on.\
You know, the rest of the stuff, but this is actually, I think, a
relatively small project, and in quantitative terms, say, separate chart
of accounts mapping can\'t be one-to-one in every instance, so that
means it can\'t be one-to-one. Walk us through that. What was I saying
again? Walk us through that, like, yeah, so specifically on cash
transactions.\
For, I\'m trying, historically, I am trying to identify where we spent
money. So anything hitting 11101, which is the operating cash account,
we need to, I currently have a lookup table that in Excel, where it
tries to define if it was payroll or operating expense or the
distribution or whatever the case was.\
And so we can\'t have 11101, the operating account can\'t always be the
same, is not always the same use. I think a lot of the other accounts
can be.\
One to one, and if we don\'t need the historical view here, then that
that lookup could could have it somewhere else, but if I understand what
we\'re trying to do with the chart of accounts mapping.\
It needs the richer layer of data.\
Um, let me\...\
See what we have here.\
Escaping your comments, Sarah.\
One moment.\
Right, so if we get the\...\
Hmm, I\'m not even sure what the point of this is.\
Double table.\
Because the GL account table here is intends to directly replicate on a
one-to-one basis all the accounts that you have in the chart accounts.
Then if for from an account to Biz Apps accounting standpoint, that\'s
correct. I think it\'s one that we\'re doing cash flow modeling.\
If we want to allocate activity in the cache account to and does an
activity to a type, that\'s that\'s.\
gonna come from? Oh, I see. For the finance platform, once we\'re
talking about like cash flow forecasting and budgeting and stuff like
that, yeah.\
Okay, I don\'t think that affects this, though, does it? It may not. I
may have tooth brothoscope in my brain. I don\'t know that it does,
because we also have dimensions. And we\'re\...\
Yeah.\
They are, yeah, I guess it\'s the offs, yeah.\
We can make it through that. So the goal of this meeting was several
fold. One is I just wanted to have a quick calibration meeting in terms
of the flow of data between the business application, which is going to
be Blue Cypress, and the accounting system, which is a little bit
different than how most people do it. Most people, accounting systems
tend to have all the detail from the customer data that\'s in there
from.\
one source or another, and we\'re not gonna do that anymore. And so
that\'s gonna be a little bit of foreign to you guys, because you\'re
not gonna have that data in Business Central. Business Central will only
have the summary transactions for whatever the cut over data is. So
we\'ll obviously have to go through a bunch of testing, planning, all
this stuff, and then we\'ll have a cut over, and then once the cut over
happens, then you\'ll have all that historical data with Business
Central prior to that date.\
That there is an issue with these kinds of systems when you cut over is
that you have to be able to, like, well, what about there\'s a cut over?
Let\'s say it\'s September 30th is our cut over or whatever, October
1st. Okay, cool. On October 1st, all new transactions go into the order
entry system, but what about open AR that existed in this and business
central previously?\
So we\'re going to have to deal with that. We\'re going to have to bring
that over in some way. So we\'ll have to account for that. Yeah, I think
that\'s a shift for me is like, who\'s the audience? We have detail in
the GL today so that when we\'re looking at a Power BI report, someone
can see where they spent their money or which comes or gave them
revenue. But that will be available. Hopefully there\'s a dashboard that
will be in the back.\
Yeah, I think we basically just need to find a backfill of this database
with all of the data from Business Central from customer orders and
payments. As a starting point, we\'ll have to unify the customer data
with the CDP. It should be already because there\'s an integration for
that. But then we\'ll have to just, right now we sub-mate invoices and
payments as to limited pieces of information, but we basically need to
map Business Central schema.\
for this and then backfill like in the native conversion, like at least
the last, at least through the beginning of the year, but probably even
the last couple of years while we\'re at it and most import it all in.
The most critical thing is open AR, because you\'ll need to be able to
apply a payment in the new system on October 1st to an invoice that was
issued in Business Center.\
So, we\'ll make that happen. It\'s a little bit of a fancy \*\*\* to
make it happen.\
The alternative to that is to not do that in the apply to payment in
Business Central, like those, or this stuff is worked out. Yeah, let
those work themselves out in Business Central, but then you have two
sources of truth. I think the history in here is good, because then we
do all the analytics. If you map it properly, the analytics are
beautiful. I mean, we\'ll have, we\'ll have all that power jack \*\*\*\*
gets thrown out, which we\'ll have that really good stuff.\
I mean, not all of it, the stuff that\'s related to, like, not customer
related stuff, we\'ll still be fine for now in there, and then
eventually, once we get the finance, I\'ll start calling FPNA. Once we
get the FPNA layer on top of all this, which you guys don\'t even know
about yet, but that\'s another another project that sits on top of all
this, that FPNA layer will give you.\
Everything, and then this is central, which basically becomes a stupid
file cabinet.\
Okay.\
Really important, a very important file cabinet. Most file cabinets are
important, you know, filing cabinets, you know, like if there\'s a flood
and you lose one, that would suck. One other quick thing.\
I.\
Biz apps contracts, let\'s talk about that. So this needs to be the
design for orders, payments, subscriptions, contracts needs to be
thought through a little bit. We have an existing contract management
system in the VC data platform right now. It is, I would call it like a
partial implementation of a contract management system. It\'s missing a
lot of pieces.\
One of the pieces that\'s missing is actually like the whole process of
signing contracts, which I mentioned on like DocuSign, all that kind of
stuff. So that\'s why I want to look at like making that an NJ primitive
to do e-signature very easily, but.\
And anyways, what I wanted to point out here is that contract management
is kind of like a layer on top of order management subscriptions. So a
contract, like in a simple situation, I might like just, you know, buy a
pen or whatever, right? But let\'s say I have a contract that\'s like,
you know, a multi-year agreement and it covers several products,
there\'s a whole bunch of terms and conditions associated with it.\
That\'s kind of like a higher level construct that is in order. It is,
it\'s similar to an order, but contracts also have a renewal cycle to
them. They\'re actually in the design here, a contract potentially could
have many different subscriptions in it. Because each subscription is
for a particular product, but in a contract, someone might contract with
blue cycles to say, hey, I want to buy Izzy.\
and skip, and I want to buy a whole bunch of services from Blue Sector
Consulting, and I want to buy a whole bunch of other things. And it\'s
just one contract that has all this stuff in it. Some of that stuff is
professional services, some of that which is not recurring typically,
some of it is recurring SaaS service stuff. There could be a lot of
different things, right? They could be buying a t-shirt, you know? So
there\'s just all sorts of things in a contract.\
So contracts, we need to think through all that way, way more depth.
Like there\'s a basic plan that\'s out there. The accounting part is
what I want to really nail first, but like the contract management
system will sit on top of all this and generate orders and subscriptions
and stuff like that. Does that kind of make sense? Yeah. A couple
questions. So.\
Right, so for this, we\'re gonna support Postgres, right? We\'re gonna
do, yes, we\'re gonna build on SQL, but we\'re gonna, we\'re gonna do
the PG migrate for all the every every open app we do will do PG
migrate, so it was then Bizash Commons gonna need to do the same thing
because it doesn\'t have an APC, yeah, and how sort of conversion we
have for the clause go PG migrate?\
All of the latter phase, like space four is basically based on it
entirely being an MJ instant. So how would we? I would think what you
can do, I mean, DG migrate essentially is a skill that says, hey, use
the Docker Workbench setup. And so what I would suggest to you is just
basically you can instruct that version of people. We have the DG
migrate, we have like a stub.\
in each of the open app repos that points to the file for BG migrate in
the MJ repo and just say do what\'s in here but relative to this repo.
Should probably pretty much figure it out. Because Docker Workbench is
nothing but a bunch of Docker compose files. There\'s nothing else to it
other than that\'s just instructions and Docker compose files. So if it
knows what the MJ repo is through the GitHub URL.\
then if you go to the MJ repo, it can read the full PG migrate command
there. So as you upgrade the PG migrate command in the MJ repo, we\'ll
keep investing in making that better and better. Then the clock code,
like in all the other repos, will just point back to that URL. So
you\'ll have like a little bit like a paragraph or something, and then
it will point back, and it will say, take advantage of the same
infrastructure that\'s in the MJ repo.\
Pull all the docker files, everything from there, and just read it
there. I think it\'ll just work. OK, yeah, I, I was, I think, like, for
transcription, it\'ll still be fine. I was curious how the phase four,
like, the smug text would work for now. I mean, for Biz Apps Common
committees, tasks, all that stuff, we definitely, we want to have PG for
everything, so I would say, like, let\'s try it out with Biz Apps Common
and see what happens. OK.\
And then for accounting, where do you think is the best place for Madhav
and I to start, like today? What would you say? My recommendation is
pull the repo, get it built, get it. So there\'s a migration there
already. I went through the migration of code gen, so you should have
like a function thing where, like, it doesn\'t do anything yet, but
it\'s basically what I have here is.\
ability to go and take a look. So this apps accounting, get all the
entities, so I can go in here and look at currencies and it\'s got some
seed data in here, so you can go look at the data. It\'s all the usual
MJ stuff. So all of this should be in place when you go into this apps
accounting. So that\'s just the starting point. One thing that you could
do is talk to the plot about building like.\
see data for like a big company, because we can\'t really test this
until we have like some big data in it. So I would do that as well. And
that would be useful later on in the Biz Apps accounting repo to have it
for association demo V2 stuff we\'ve been talking about. This is a
module that will or an app that we want to have installed that has its
own sample data. So we\'ll want this sample data that we build for
testing to build off of the association demo database.\
Right now, do you guys know off hand, does association demo worksheets
database, does it have hard-coded, pre-generated ID values for
everything, or does it generate those on the fly?\
I\'m a, I\'m a really touch business. I was wondering about, I can ask
Jordans, I know the ones that use it the most. Yeah, let\'s let\'s ask,
let\'s just look at it. If you just look at the install script, you can
figure it out in two seconds, and but basically what we wanna do is we
wanna have deterministically assigned static ID values for every
customer and every every single record that goes in, and the reason you
want that for the next version.\
is then we\'ll build a sample data set here that builds off of that. So
we\'ll make the assumption that, like, because we\'re going to use Biz
Apps Common, and we\'ll have the portion of more cheese that\'s out
there now that\'s relative to Biz Apps Common will have a piece there,
the automatic piece here, you know, all the pieces related to their
systems. So ultimately, once you stack it all up in our association demo
V2, we\'ll install Biz Apps Common.\
Biz apps committees, biz apps tasks, biz apps counting, biz apps orders,
biz apps contracts, blah, blah, blah, blah. We\'ll install it all. Each
of these apps will have its own app, like sample app data, and then
they\'ll stack up on each other. And if all the four, if all the primary
keys are hard-coded, then they all, they can all hide each other, if
that makes sense. The long install will all be beautiful.\
I guess it\'s based on the script, it\'s probably, yeah, it\'s probably
done if we\'ve generated through the sequential ID, so, well, we\'re
gonna what we have right now, we\'re throwing out anyway, because we
have a whole new schema, so, right, but this is just more of a note to
Claude for the reporting that we will transcriptize and and share that
once you guys are all on the front, so, and\...\
is central. I already mentioned that. Is that what the current system
is? That\'s what our accounting system is, both current and for the
foreseeable future, we\'re using that. That\'s our GL system, our
accounting system. We might need to issue a license. I don\'t know that
they didn\'t get into it, but I think we need to integrate. So I was
actually thinking in terms of cloud distribution of.\
Later, between you guys, you know, Madhav, your Mister integrations,
maybe you can look at the Business Central API and take a look at that
piece while you\'re looking at just getting it up and running. Both of
you should get it up and running locally, so you have it, and then I
would just start getting into it and say, okay, like the biggest
functionality we have to build is we have to\...\
get really good UIs built for all these key entities, so a really good
UI for jail accounts, for journal entries, journal entry line items, all
that stuff. But the main business process that happens in this
accounting system is batching, where we basically take journal entries
and we batch them up and then we transfer them over. So we have to look
at the control flow for that and we have to look at the business logic
to do the batching.\
Um, and then the X for effect goes back to Business Central
automatically, uh-huh, so I would say, like, break that up and make
sense, yeah, transcripts so.\
Cool, all good. Yeah, that makes sense. Alright, keep going. Now you
guys are now you guys are accountants.\
Alright, Dan, we recorded the whole thing for you.

**Amith Nagarajan** stopped transcription
