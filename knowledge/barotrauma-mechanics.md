category: barotrauma

## Afflictions
0.10.5.1
Afflictions are status effects which characters can receive through varied means and can have positive or negative effects. They are the only way of influencing a character's Vitality.

=Afflictions Mechanics=
    1.  Health GUI
Afflictions are displayed as icons above the health bar, and detailed information can be seen through the health UI (which is accessed with the [H] key, or by clicking on the health bar or character portrait).
The health UI shows:

-  The limbs affected (do note that some afflictions affect the whole body and are always displayed on the torso/head)
-  The overall state of each limb, signalled by its color, from Green (buffed) to Yellow (normal) to Red (heavily afflicted).
-  A list of the afflictions affecting the currently selected limb, displayed with a colored gauge under their icon which represents the strength of the affliction (Light, Medium or Heavy); most afflictions range from 0 to 100 strength
-  A description of the currently selected affliction, along with the total amount of Vitality it has drained so far
-  A list of suitable treatments (may be misleading, only characters with high enough Medical Skill will get an accurate list of treatments) for the affliction.

Most afflictions can be treated by applying a suitable treatment, from the Health GUI, by dragging and dropping the treatment on the affected limb.
Some afflictions do not display an icon at low levels of severity.

    1.  Affliction Strength

Most Afflictions range from 0 to 100 strength, with the exception of Oxygen Low (max 200).Stun and Buffs also have various maximum strengths, as their strength values also act as a timer, losing 1 strength per second.
However, some Afflictions are limb specific, and if several limbs are afflicted, the combined strength value may exceed 100.

For some Afflictions, this maximum strength will then be scaled to the character's maximum Vitality, which varies from 80 to 100 depending on their Job. As such, an Affliction with a maximum strength of 100 will instead be capped at 80 when applied on a Captain, whose maximum Vitality is 80. Internal Damage, Burn, Oxygen Low, Bloodloss, and High Pressure are the only scaled Afflictions. Obviously, the affliction damage values of endured attacks is not scaled to the target's Vitality.

## Gardening
0.10.5.1

Gardening is a mechanic in Barotrauma allowing submariners to grow renewable resources from the safety of their submarine. There are four different growable plants that produce special fruits which can be crafted into different items, or just thrown about and splattered on the hulls of the sub.

The seeds can be bought either in a city and/or a research outposts, found in submarine wrecks or by deconstructing fruits.

They can be also deconstructed, each yielding 1 carbon.

    1.  Method

To start a garden, first place a Small Planter Box (Remember to place. dont drop it on the floor or it's not gonna work) inside the submarine. Then, use a Seed on the box in order to plant it.

The bud consumes water over time and grows. A Watering Can is used to refill the Planter Box with fresh water.

When mature, the plants will bear and drop fruits by the Planter Box.

If the water in the Planter Box runs out, the plant will die. Dead plants can be uprooted by hand, allowing the Planter Box to be repotted or removed entirely.

Planter Boxes in contact with seawater will be drained of their fresh water supply.

Fertilizers can be used on Planter Boxes to double the growing speed.

Seeds can be stored in Seed Bags.

Deconstructing fruits yields its seed and either Carbon or Sodium.
    1.  Plants

{| class="wikitable"
!Name
!Uses
!Yield
|- id = "Raptor Bane Seed"
|align="center"|Raptor Bane Seed
|Yields Raptor Bane which can be processed into Raptor Bane Extract, a nauseant for humans, a lethal poison for Mudraptors.
Yields Mutated Raptor Bane which has no use but recycling.
|Raptor Bane 40%
Mutated Raptor Bane 60%
|- id = "Pomegrenade Seed"
|align="center"|Pomegrenade Seed
|Yields Pomegrenade which can be processed into Pomegrenade Extract, a mild, non-addictive, healing item.

Yields Mutated Pomegrenade which will explode, deal damage, and start a fire upon even a light impact with the ground/platform. Will not explode if it spawns on a platform directly.

|Pomegrenade 90%
Mutated Pomegrenade 10%
|- id = "Salt Vine Seed"
|align="center"|Salt Vine Seed
|Yields Salt Bulbs which can be deconstructed into Sodium. Salt bulbs are water reactive and will explode upon contact with water.
|Salt Bulb 60%
|- id = "Tobacco Vine Seed"
|align="center"|Tobacco Vine Seed
|Yields Tobacco Buds which can be processed into Pipe Tobacco, which when smoked in a Captain's Pipe, grants minor Psychosis Resistance
|Tobacco Bud 70%
|}
Note: All seeds deconstruct into Carbon x1 in 30 seconds.

## Maintenance
1.  Fire

    1.  Dangers
Fire deals damage to crew members touching it, but most importantly, drains oxygen from the room it's in, and it inflicts constant damages upon affected installations. It will also explode any of the Oxygen Tanks or Welding Fuel Tanks on contact (especially those that are in your inventory).

    1.  Causes
Fire is usually caused by electricity-related mishaps, most commonly overloading. This tends to result in multiple installations catching fires, overwhelming the crew. The thermal artifact will also set anything it touches on fire. Obviously, fire can occur during reactor meltdown.

    1.  Dealing with fires
Fires need access to oxygen to keep going, which informs the ways used to deal with them. The Fire Extinguisher is the most obvious tool for the job, but tends to be insufficient when dealing with multiple fires at the same time.

    1.  Flooding

    1.  Dangers
Flooding is an omnipresent menace in Barotrauma. While items and installations are waterproof, the crew can easily drown; moreover, the intense pressure found in the ocean will crush unprotected crew members found in completely submerged areas, instantly killing them. On top of these immediately lethal consequences, flooding also weighs down the submarine and makes sinking easier.

    1.  Causes
The excess water can come from three sources: hull breaches, opened doors to the outside, and, a lot less likely, pumps being set to fill the submarine uncontrollably. In both cases, water will naturally flow toward the lowest available location not entirely flooded and begin to fill up rooms after rooms.

    1.  Dealing with flooding
A diving mask temporarily prevents its wearer from drowning, and a diving suit has the additional effect of protecting from pressure; putting on the appropriate equipment can save your life and give you the time necessary to take additional steps. Don't forget the required Oxygen Tank. Cautious crew members frequently store this equipment in their inventory (taking care not to use up the oxygen beforehand) just in case, to put it on quickly when needed. Without it (or access to it), swim toward breathable air hoping to reach it in time; until the flooding is dealt with (or you flee for a safer area) you will have to resurface regularly to take a breath.

Once immediate survival is ensured, the highest priority is to investigate and determine the origin point(s) of the flooding. In the case of a hull breach, the impact having caused the breach should be noticeable enough to orient the researches. The Status Monitor can help in this endeavour by mapping the flooded areas. Finally, one can follow the water falling downward or the current to locate the origin point of the flooding.

## Orders
0.10.5.1
Orders are instructions used to direct the AI-controlled crew. While the crew will take initiatives on their own, orders help them react in more intelligent ways.

    1.  Usage
- The Orders radial menu is opened with the Middle Mouse Button (or Mouse 3) by default.When using the Orders key on a crew member directly, or on their name top-left of the screen, any selected order will be given to them.If the menu is opened by clicking anywhere else, a list of the crew may be displayed by right-clicking an order; left-clicking on a crew member will issue the order to them. When left-clicking an order directly, the first relevant crew member will be automatically selected.Holding the Shift key and then using the orders key on certain installations, the radial menu will only display orders relevant to that specific installation; for instance, doing so on a weapon's periscope will display the Operate Weapon order.Crew members can be dismissed from an order by right-clicking the order, next to their name in the top-left crew display.

- If an order requires using a specific item, such as a screwdriver to repair a junction box or a Diving Suit to fix leaks in a flooded room, they will first try to find it within the submarine's containers or laying on the floor. If no required items are found or if they are in another crew member's inventory, they won't take it from them and will be unable to complete their order, stating so in the chat.
- Issuing an order can be done preemptively: for instance, if ordering a crewmember to Fight Intruders when none are in the submarine, they will answer that they can't find any, but will remain assigned to this task and when intruders arrive they will fight them.
- Up to 3 orders can be saved for quick re-assignment; when giving a new order to a crew member, their previous order will be moved to the right and its icon made smaller; left-clicking one of the previously dismissed orders will issue it again, letting one quickly cycle between orders depending on the situation. Preparing these quickly accessible orders at the beginning of a round may save a lot of time afterwards.

=Emergency=

## Skills
0.10.5.1
Skills are percentage-based levels determining how capable a character is at performing a specific task. Depending on the job the character has, they will be given a ranged percentage of skill in each field.

    1.  Weapons
Determines a character's effectiveness with certain weapons. Not having the required skill level to use a weapon will hinder its performance in a particular field, and not having the required skill level to craft items will make the item take longer to craft.

Security Officers, followed by Captains have the highest level of weapon skill in the crew.

Ways to improve the Weapons Skill:
-  Firing weapons
-  Killing enemies with weapons
- Crafting weapons and ammunition

{| class="wikitable"
! class="header" | Weapon
! class="header" | Skill Level
! class="header" | Handicap on Insufficient Skill
|-
| style="text-align:left;" | Railgun
| style="text-align:center;" | 50
|Slower rotation, railgun crosshair takes longer to align with aim position.
|-
| style="text-align:left;" | Coilgun
| style="text-align:center;" | 50
|Slower rotation, coilgun crosshair takes longer to align with aim position.
|-
| style="text-align:left;" | Harpoon Gun
| style="text-align:center;" | 30
|Firing spread +9 (from 1 to 10).
|-
| style="text-align:left;" | Syringe Gun
| style="text-align:center;" | 15 (Weapons)
30 (Medical)
|Firing spread +10 (from 0 to 10).
|-
| style="text-align:left;" | Revolver
| style="text-align:center;" | 40
|Firing spread +2 (from 0 to 2).
|-
| style="text-align:left;" | SMG
| style="text-align:center;" | 50
|Firing spread +6 (from 10 to 16).
|-
| style="text-align:left;" | Flamer
| style="text-align:center;" | 20
|Fuel used up 50% faster.
|-
| style="text-align:left;" | Grenade Launcher
| style="text-align:center;" | 60
|Firing spread +9 (from 1 to 10).
|-
| style="text-align:left;" | Riot Shotgun
| style="text-align:center;" | 60
|Firing spread +9 (from 1 to 10).
|-
| style="text-align:left;" | Stun Gun
| style="text-align:center;" | 20
|Firing spread +2 (from 0 to 2).
|}

    1.  Mechanical Engineering
Determines whether a character can operate certain Tools safely and what can be crafted in the Fabricator. Not having the required skill level can cause the tools to be less efficient and makes items take longer to craft.

Mechanics have the highest level of mechanical engineering skill in the crew.

Ways to improve the Mechanical Engineering Skill:
-  Repairing hulls
-  Performing mechanical repairs on Installations
-  Manufacturing items requiring the Mechanical Engineering skill in the Fabricator

{| class="wikitable"
! class="header" | Tool
! class="header" | Skill Level
! class="header" | Effect on Insufficient Skill
|-
| style="text-align:left;" | Plasma Cutter
| style="text-align:center;" | 30
|Oxygen Tank / Oxygenite Tank is used up 3x faster.
|-
| style="text-align:left;" | Welding Tool
| style="text-align:center;" | 20
|Welding Fuel Tank / Incendium Fuel Tank is used up 3x faster.
|-
|}
