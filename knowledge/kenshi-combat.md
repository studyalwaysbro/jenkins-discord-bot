category: kenshi

## Combat Speed
1.  Combat Speed
Combat Speed is a multiplier to your attack and block speed. It is affected by a combination of your Armour (Most Heavy Armour reduces it, Assassin's Rags and Wooden Sandals increase it), encumbrance % and if you have the required strength level (40x blunt damage or 1x weight whichever is greater, for Martial Arts it is equal to 80% of MA level) to use a weapon.

Training your Dexterity and Attack/Defense skills are generally the primary method of increasing your attack and block speed, but this does NOT impact combat speed. As an example, the base attack speed is believed to be 0.765. Each level of attack increases your attack speed by 0.00152. Each level of Dexterity increases it by 0.00228. If a character were to have 100 Attack and 100 Dexterity that would result in 1.145 attack speed. Attack, Dexterity and Defense levels are additive to attack (Attack and Dexterity) and block (Defense and Dexterity) speeds. Combat speed multiplies the final attack and block speed value you have. So, if you were to be wearing Wooden Sandals you would have 1.20225 attack speed with 100 Attack/Dexterity. (Attack speed caps at 1.2 so the extra 0.00225 would just help slightly if injured)

Oddly enough, Dodge is completely unaffected by Combat Speed. The movements take the same amount of time regardless. Similarly odd, if they were affected, they appear to be set to look at the Martial Arts skill instead of Dodge as their other speed enhancing skill besides Dexterity.

    1.  Details
All weapons have a required Strength level to wield effectively, usually determined by the Blunt Damage of the weapon. In some cases, this equals out to x2 the weight of the weapon however this formula does not work for a LOT of weapons such as any Katana, Polearm, Jitte, Heavy Jitte, multiple Sabres and other weapons at lower qualities. If one does not have the required Strength to wield a weapon, this will result in a penalty to their speed combat. This scales as far as around -47.5% at 20 levels or more under than the required level. For every level above the 20 levels mark, the penalty will decrease by about 2.375% until you reach the required level.

Contrary to what has long been believed, damage types appear to have no direct effect on speed, or what skills are taken into consideration. As mentioned above, Blunt Damage affects the required Strength level of a weapon, meaning that in some cases Strength can be seen increasing the speed of a weapon, but in truth it is simply reducing the penalties instead. Assuming you have enough Strength to wield the weapon, extra Strength will have no effect on speed.

## Damage
Kenshi has a complex damage system where types of damage and the affected bodypart have different results for the character. This includes factors such as KO times and which skills get penalties.

If the total health of a vital limb (head, chest, stomach) falls below a character's KO point (which is determined by Toughness), the character will enter a recovery coma.

    1.  Stun Damage
Stun damage (commonly referred to as Blunt Damage) is an inflicted damage type. When a character is hit with a weapon dealing blunt damage, it decreases the condition bar of that targeted area without causing bleeding. This damage does not need to be bandaged with First Aid Kits and will heal on its own.

    1.  Cutting Damage
Cutting damage is an inflicted damage type. When a character is hit with a weapon dealing cutting damage, it causes them to bleed. Cutting damage worsens over time if it exceeds 20% of your maximum health. Therefore it is important to bandage cuts with First Aid Kits (or Skeleton Repair Kits if the damaged limb or character are robotic).

Wound degeneration speed has a baseline (1x) at 30% of your maximum health in cut damage. Every 10% extra cut damage appears to add +1x onto that. For example, at 80% cut damage you would worsen 6x faster than at 30%. As such, at very high cut damage your injuries may worsen faster than you can heal, leading to death. Wound degeneration is not active when laying in any type of bed, and most animals are not affected by it unless they are unconscious.

Note: sometimes you might see the term "Negative Bandaged Health". This relates to cut damage which goes over 100% of a limb's health getting bandaged; this is not shown in the game's UI, as the bars only go down to 0 and the numbers next to them only show the current total health.

    1.  Damage Calculations
The damage that you take is cut damage/stun damage modified by your armor and toughness. See Resistances for additional information. Cut resistance and Blunt resistance are from worn armour.

BluntDamage = RawBluntDamage * (1 - BluntResistance) * (1 - DamageResistance)

CutDamage = RawCutDamage * (1 - CutResistance) * (1 - DamageResistance)

The resulting cut damage is used again for the next armour piece. The raw cut damage that already was resisted by armour cannot be reduced further. For example, if an armour piece had 80% Cut resist the next armour piece would only be able to resist the remaining 20% of the cut damage.

Armor also has a Cut Resistance efficiency. This is the amount of cut damage that is converted into stun damage.

AdditionalStunDamage = RawCutDamage * CutResistance * (1 - CutResistanceEfficiency)

The additional stun damage is not reduced by armour.

The values shown when hit in game (Provided floaters are enabled) is a sum of cut damage and stun damage.

    1.  Blood loss

## Damage/Limb Data
The following is a breakdown of health and hit chances for each limb by race.

Notes:

-  The % Hit Chances are prior to being hit and Hitmult being applied.
-  Animal health shown is at age 1.1.
-  Animal front limbs are labeled as Arms in the below charts.
-  Unique boss animals are not listed.
-  Please note that many % Hit chances shown do not always show the exact percent, most are cut off a few decimals in.
-  If a % Hit Chance shows a value like 2.08333...% this means that the 3s are repeating.
-  The races are split into groups of up to 3 to hopefully prevent issues on smaller screens.

    1.  Playable humanoid races
{| class="article-table"
!Hiver
! colspan="3" |Hive Soldier Drone
! colspan="3" |Hive Worker Drone
! colspan="3" |Hive Prince
|-
!
!Limb Health
!Hit Chance
!% Hit Chance
!Limb Health
!Hit Chance
!% Hit Chance
!Limb Health
!Hit Chance
!% Hit Chance
|-
|Head
|200
|80
|14.2857%
|125
|80
|14.2857%
|80
|80
|14.2857%
|-
|Chest
|100
|140
|25%
|75
|140
|25%
|80
|140
|25%
|-
|Stomach
|100
|60
|10.7142%
|75
|60
|10.7142%
|80
|60
|10.7142%
|-
|Left Arm
|100
|80
|14.2857%
|75
|80
|14.2857%
|80
|80
|14.2857%
|-
|Right Arm
|100
|40
|7.1428%
|75
|40
|7.1428%
|80
|40
|7.1428%
|-
|Left Leg
|100
|80
|14.2857%
|75
|80
|14.2857%
|80
|80
|14.2857%
|-
|Right Leg
|100
|80
|14.2857%
|75
|80
|14.2857%
|80
|80
|14.2857%
|}
{| class="article-table"
!Human
! colspan="3" |Greenlander
! colspan="3" |Scorchlander
|-
!
!Limb Health
!Hit Chance
!% Hit Chance
!Limb Health
!Hit Chance
!% Hit Chance
|-
|Head
|100
|80
|12.5%
|100
|80
|12.12%
|-
|Chest
|100
|140
|21.875%
|100
|140
|21.21%
|-
|Stomach
|100
|140
|21.875%
|100
|140
|21.21%
|-
|Left Arm
|100
|80
|12.5%
|100
|80
|12.12%
|-
|Right Arm
|100
|40
|6.25%
|100
|60
|9.09%
|-
|Left Leg
|100
|80
|12.5%
|100
|80
|12.12%
|-
|Right Leg
|100
|80
|12.5%
|100
|80
|12.12%
|}

{| class="article-table"
!Skeleton
! colspan="3" |Skeleton
! colspan="3" |P4 Unit
! colspan="3" |Soldierbot
|-
!
!Limb Health
!Hit Chance
!% Hit Chance
!Limb Health
!Hit Chance
!% Hit Chance
!Limb Health
!Hit Chance
!% Hit Chance
|-
|Head
|200
|80
|13.33%
|150
|80
|12.5%
|200
|80
|12.12%
|-
|Chest
|200
|140
|23.33%
|200
|140
|21.875%
|200
|140
|21.21%
|-
|Stomach
|200
|80
|13.33%
|200
|140
|21.875%
|200
|140
|21.21%
|-
|Left Arm
|200
|80
|13.33%
|200
|80
|12.5%
|200
|80
|12.12%
|-
|Right Arm
|200
|60
|10%
|200
|40
|6.25%
|200
|60
|9.09%
|-
|Left Leg
|200
|80
|13.33%
|200
|80
|12.5%
|200
|80
|12.12%
|-
|Right Leg
|200
|80
|13.33%
|200
|80
|12.5%
|200
|80
|12.12%
|}

## Resistances
Blunt resistance, Cut resistance, Cut resistance efficiency (previously Stun), Harpoon resistance, and Coverage are statistics on pieces of armour that affect how much Damage a unit takes from another unit's attack.

    1.  Coverage
Coverage is simply the chance that armour will protect against a hit to that limb. So, a 100% chest coverage will apply its resistances on every hit to the chest. While a 50% coverage will only do it half the time. Meaning that 80% coverage does not translate to covering 80% of the Damage Taken calculated for this hit, but that for 20% of hits the armour will offer no protection.

    1.  Layering
In the case of overlapping coverage areas, damage resistance is determined based on the slot the items use. It will run through them in order of: Head, Armor (Chest), Pants, Shirt, and then Boots. Environmental resistances are a sum total.

    1.  Damage Resistance

    1. # Blunt Resistance
Whenever an attack successfully hits a unit, the damage is theoretically calculated as follows:

AD: Attack damage / "Raw damage" BR : Blunt/Cut resistance / "Armour effect" DR: Damage resistance / "Toughness effect" Damage taken = AD * (1 - BR) * (1 - DR)For example, say a 100 Blunt Damage attack is going to hit your character's chest (not blocked) while they are wearing a Standard Grade Plate Jacket, which has 14% blunt resistance. Your unit has a toughness of 70, which gives a 26% (0.26x damage resistance). So, our final number would look like this:100 * (1 - 0.14) * (1 - 0.26) = 100 * 0.86 * 0.74 = 63.64 damage taken

    1. # Cut Resistance and Efficiency
Cutting Damage uses the same initial calculation but triggers a Damage Conversion calculation. All resisted cut damage is then applied against the Cut Resistance efficiency (CRE) statistic to determine how much of the resisted damage is carried over as unmitigated Blunt (previously calculated as Stun) damage. 90% is the maximum cut resistance possible on a single piece of armour.

For example, let's use 75% cut resistance and 60% cut resistance efficiency with no Toughness modifier for simplicity. Your character is hit for 50 cut damage. The armour negates 37.5 damage applying the formula above, sending the remaining 12.5 to be applied to any overlapping armour. The 37.5 resisted cut damage goes through the following (Stun) calculation:(Stun) Damage = Resisted Cut Damage * (1 - CRE) = 37.5 * (1 - 0.60) = 37.5 * 0.4 = 15 damageThis (Stun) damage will be converted to blunt and instantly applied (ignoring any other armour). This means that if you had no other armour you took a total of 27.5 damage, 12.5 cut and 15 blunt. Keep in mind though, this (Stun) damage ignores further layers of armour. So, you may want to avoid armour with a low-Cut resistance efficiency value in slots that get hit early on in the order.

The total cut resistance of an armor is CR * CRE, which is 45% for the example above.

## Weapons
Catun Scrapmaster
Combat is a primary part of Kenshi, and all combat except for martial arts is done with weapons. Weapons are items that are split into multiple categories, each dealing different types and amounts of damage. Armour is designed to reduce damage and can be slightly penetrated by using certain weapons. Weapons can be looted, purchased from a Weapons Trader, or crafted by the player.

    1.  Equipping Weapons
Characters in Kenshi have two weapon slots: Weapon I (primary slot) and Weapon II (secondary slot). All weapons can be equipped in the primary slot; however, weapons may only be equipped in the secondary slot if they possess no larger than an Inventory Height of 1 and an Inventory Width of 7. Characters will typically use what is equipped in Weapon I over Weapon II unless penalties are applied, such as the left arm being unusable or using certain weapons indoors. If the right arm is unusable, the character will not use equipped weapons. Multiple weapons may be equipped within Weapon I, but the character will only use the topmost weapon in that slot in combat. The bonus stats (and debuffs) will only apply for the weapon currently being used.

    1.  Melee Weapons
These are weapons which make use and train a character's Melee Attack and Melee Defense stats, as well as the specific melee weapon skill associated with the weapon type.

Weapons/Classes|Weapon Classes
Weapons/Damage|Weapon Damage Comparisons
Weapons/Modifiers|Weapon Modifier Comparisons

    1.  Ranged Weapons
These are weapons which make use and train a character's Precision Shooting and Perception stats, as well as the specific ranged weapon skill associated with the weapon type.

    1.  Crossbows
Crossbows are ranged weapons which are equipped in a character's primary weapon slot. These weapons require ammunition. Crossbow grades are more similar to Armour grades than to Melee Weapon grades.

    1.  Turrets
Turrets are defensive buildings which have unlimited ammunition.

ru:Оружие
