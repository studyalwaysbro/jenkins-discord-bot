category: barotrauma

## Battery
current steam version]].
Battery (disambiguation)

Batteries are stationary installations able to store and release electrical power.

    1.  Function
Batteries can be useful for stabilizing the submarine's power. They can absorb power when the Nuclear Reactor overproduces and threatens to overload and damage connected devices. When the reactor fails to provide enough power for devices to function (whether the reactor is offline, disconnected, or damaged), batteries can provide back-up power for a substantial amount of time depending on the amount of power they have stored. This allows maintenance to be safely performed on the reactor in the event of an unforeseen problem.

Moreover, up to 3 Battery Cells or Fulgurium Battery Cells at a time can be placed into the battery to be recharged.

    1.  Damage Values

    1.  Decay rate
A battery's rate of decay is not dependent on whether it is connected to the grid or not. This is to say that two batteries of equal charge will drain at the same rate even if one is not connected to the grid, and the other is, however this does not take into account that the battery connected to the grid will be charged as long as a reactor is active. The decay rate of batteries does change if a battery is submerged in water.

    1.  Connection Panel

The connection panel of a battery has two main contacts, *Power In* and *Power Out*. Unlike a real battery, a battery in barotrauma only needs one contact to be charging, this is the *Power In* The same is true for powering devices from the battery, however the required contact is *Power Out*.

## Camera
The Camera is a stationary installations in Barotrauma. It allows you to look outside the submarine.

    1.  Function
The Camera is useful for seeing potential targets or generally observing the outside area of the submarine.

The Periscope is where a crewmember operates the Camera. In the submarine editor, the Periscope's position_out must be wired to where the Camera's control_in pin is. Only one crewmember can operate a Periscope at a time. The connected Camera is aimed using a crosshair that replaces the mouse when interacting with the Periscope.

Attempting to connect more than one Camera will default to the first camera connected.

    1.  Connection Panel

## Charging Dock
The Charging Dock is an installation that can be used in Barotrauma.

    1.  Function
The Charging Dock has 4 slots in which Battery Cells and Fulgurium Battery Cells can be placed, the moment they are placed they will begin recharging.

Interestingly enough the Charging Dock's and Battery's recharge speeds are identical, so the only difference would be the amount they can recharge at a time. (3 for the Battery and 4 for the Charging Dock)

## Coilgun
The Coilgun is a stationary weapon in Barotrauma. It is composed of three installations: the Coilgun proper (which itself is made up of the base and barrel), the Periscope, and the Coilgun Loader. The Coilgun requires Ammunition Boxes, a Periscope and power to function.

    1.  Function and Usage
Ammunition Boxes have a distinctly shaped storage shelf to store spare boxes, and are loaded into Coilgun Loaders. Coilgun Loaders must be linked to Coilguns in the submarine editor for the Coilgun to draw ammunition from it. Loaders do not require power or wiring. A single Loader can be linked to multiple Coilguns, and a single Coilgun can be linked to multiple Loaders. A Coilgun linked to multiple Loaders will draw a fraction of a bullet from each Ammunition Box and combine the effects of each, for example combining Piercing and Explosive Boxes result in Coilgun bolts that pierce enemies and explode on the way through. Multiple Loaders with the same type of Ammunition Box do not increase effects or damage but still increase the number of available shots to the Coilgun, with each box supplying 200 shots when full. The quantity of ammunition that remains in linked Loaders is shown as a colored bullet at the top of the screen while in the Periscope or while interacting with the Loader. Green means full, yellow is partly empty, red is nearly empty, and an entirely grey bullet is completely empty. When an Ammunition Box is empty it should be removed from the Loader, a fresh Ammunition Box reloaded to replace it, and the empty box recycled in the Deconstructor for its Aluminium.

The Periscope is where a crewmember operates the Coilgun. In the submarine editor, the Periscope must be wired to the Coilgun where the Periscope's position_out pin connects to the Coilgun's position_in pin and the trigger_out pin connects to the Coilgun's trigger_in pin. Though it is possible, it is not recommended to connect multiple Coilguns to a single Periscope because the camera will center on the average position of the connected Coilguns and the crosshair will very likely not represent the location the Coilguns are aimed at. Only one crewmember can operate a Periscope at a time. The connected Coilgun is aimed using a crosshair that replaces the mouse when interacting with the Periscope. The camera will be centered on the Coilgun which also projects in a narrow, long cone towards where the Coilgun is aiming, useful for seeing potential targets or generally observing the outside of the submarine. This light can be toggled using the toggle_light wiring pin. The Coilgun's bolts travel at a relatively fast pace but lead must be taken for fast or distant moving targets, as well as taking the motion of the submarine into account. The trails left by the bolts can assist in the aiming process.

## Containers
Containers are simple Installations that provide storage space. They prove beneficial in freeing up space in a crew member's inventory, as well as organizing items in general.

    1.  Usage
Interacting with a container will open a GUI table of slots for items. From here the player can drag and drop items into or from the table to store or extract them. Double-clicking on an item also allows quick storage/extraction.

    1.  Properties
-  Some containers are watertight. This property allows safe storage of items that explode when in contact with water, such as Sodium, Potassium, Magnesium, or Lithium.
-  Access to some containers is restricted to crew members that have certain Jobs (or anyone in possession of their ID Card). In vanilla submarines, there are only two such containers: the Toxins Cabinet is restricted to Medical Doctors and Captains, and the Secure Cabinet is restricted to Security Officers and Captains.
-  While most containers can hold both small and medium items, some are limited to small items. The only medium items in the game are the Fire Extinguisher, the Harpoon Gun, all 4 types of Harpoons, the Riot Shotgun, the Boom Stick and the Grenade Launcher.
-  Crates can be held and moved freely, by opening them (left-click). They will also be subject to gravity and water flow, and in rare cases may therefore drift outside of the submarine in the event of a large hull breach and violent impacts. Storing them on a Crate Shelf prevents this.

    1.  Submarine Containers
These containers are installed on the walls, and can not be picked up and moved around.

    1.  General Containers
This table lists containers that have little to no restrictions on their allowed contents.

{| class="wikitable mw-collapsible style="text-align:left;"
! colspan="4" | General Containers
|-
! Container
! Item Slots
! Watertight
! Notes
|-
|Large Steel Cabinet || 30 || No ||
|-
|Medium Steel Cabinet || 15 || No ||
|-
|Medium Windowed Steel Cabinet || 15 || No ||
|-
|Supplies Cabinet || 6 || No ||
|-
|Secure Steel Cabinet || 20 || No || Can be ID restricted.  On default submarines, access is usually restricted to Security Officers and the Captain
|-
|Medicine Cabinet || 30 || Yes || Cannot store medium items.
|-
|Toxin Cabinet  || 20 || Yes || Cannot store medium items.  Can be ID restricted.  On default submarines, access is restricted to Medical Doctors and the Captain
|-
|Loose Panel  || 1 || No || Opened by standing close and clicking on a small area slightly left of the centerThe area is 40x40px for the big one, 30x30px for the small one
|-
|Loose Vent || 1 || No || Opened by standing close and clicking on a small area slightly left of the center.
|-
|}

    1.  Dedicated Containers
These containers have strict restrictions on their allowed contents

## Crate Shelf
A Crate Shelf (Crate Shelves) is used for storing Crates in a stable and safe manner. They can hold up to 4 crates, allowing the storage of mass amounts of items. Crates stored in a crate shelf are NOT waterproof.

    1.  Usage
Upon interacting with a crate rack, it will open a GUI table of slots for crates. From here the player can drag and drop crates into the table to store them.

    1.  Gallery

## Dedicated Containers
all containers data should now be in Containers
General Containers

Containers are simple Installations that provide storage space. They prove beneficial in freeing up space in a crew member's inventory, as well as organizing items in general.

This page lists all containers that have special restrictions on their allowed contents. For a list of containers without content restrictions, see Dedicated Containers.

    1.  Usage
Interacting with a container will open a GUI table of slots for items. From here the player can drag and drop items into or from the table to store or extract them. Double-clicking on an item also allows quick storage/extraction.

    1.  Properties
-  Access to some containers is restricted to crew members that have certain Jobs (or anyone in possession of their ID Card). In vanilla submarines, there are only two such containers: the Toxins Cabinet is restricted to Medical Doctors and Captains, and the Secure Cabinet is restricted to Security Officers and Captains. (Note)
-  While most containers can hold both small and medium items, some are limited to small items. The only medium items in the game are the Fire Extinguisher, the Harpoon Gun, all 3 types of Harpoons, the Riot Shotgun and the Grenade Launcher.

    1.  Containers

{| class="wikitable style="text-align:left;"
! Container
! Valid Items
! Item Slots
! Notes
|-
| Large Diving Suit Locker || Diving Suit icons || 5 ||
|-
|Large Oxygen Tank Shelf || Oxygen Tanks  Welding Fuel Tanks  Incendium Fuel Tanks  Oxygenite Tanks || 10 ||
|-
|Diving Suit Locker || Diving Suit icons || 1 ||
|-
|Oxygen Tank Shelf || Oxygen Tanks  Welding Fuel Tanks  Incendium Fuel Tanks  Oxygenite Tanks || 3 ||
|-
|Coilgun Ammunition Shelf ||  Coilgun Ammunition Box Exploding Ammunition Box Piercing Ammunition Box Physicorium Ammunition Box || 3 ||
|-
|Railgun Shell Rack ||  Railgun Shell Nuclear Shell Physicorium Shell || 3 ||
|-
|Fire Extinguisher Bracket || Fire Extinguisher || 1 ||
|-
|Crate Shelf ||  Metal Crate Secure Metal Crate Chemicals Crate Explosives Crate || 4 || Protects the stored crates from water
|-
|Weapon Holder || Weapons || 1 ||
|-
|}

The Alien Ruins feature a unique dedicated container:
{| class="wikitable style="text-align:left;"
! Container
! Valid Items
! Item Slots
! Notes
|-
| Artifact Holder ||  Artifacts || 1 ||
|-
|}

## Depth Charge
The Depth Charge is a submarine-mounted weapon. It can be used to lure enemies towards itself and deal damage upon impact. It is composed of the Depth Charge Tube, the Depth Charge Loader, any Depth Charge Shell, and a trigger. When triggered, the Shell is deployed out the tube to slowly sink. Upon impact, the depth charge will activate its payload.

    1.  Function and Usage
Depth charges are triggered via a Button or from Navigation Terminal. When triggered, the tube deploys a depth charge shell from a loaded Depth Charge Loader. Unlike other submarine weapons, the Depth Charge uniquely requires no power.

Depth charges slowly sink downwards, and will activate their payload upon impact with the sea floor or monster or a submarine.

Decoy Depth Charges are very loud noise-makers and will draw Creatures attention toward itself.

    1.  Damage Values
Depth Charge Shells are hollow and can be filled with an item. The payload will be activated on impact. Explosives in particular can be loaded in shells to greatly increase damage potential.

They can also be collected after use for reuse.

    1.  Audio

## Docking Port
The Docking Port and Docking Hatch are Installation used to dock two submarines together. The Docking Hatch connects to another Docking Hatch vertically, and the Docking Port connects to another Docking Port horizontally.

    1.  Function
When 2 docking ports are docked to each other, air, water, items, power, and creatures can move between subs through the docking port.

A Docking Hatch is required to dock with an outpost as Outposts only have a Docking Hatch.

    1.  Usage
When docked, the ports will:
-  transfer power between each other.
-  create a dynamic hull between the two installations. This hull protects the area from the sea.

    1.  Connection Panel
Hover over pins to see their descriptions.

    1.  Audio

## Doors
Doors and hatches are installations allowing to close off sections of the submarine.

    1.  Usage
Most doors and hatches are assigned a button allowing anyone to open or close them, but some require clearance to be opened, which is provided by possessing the appropriate ID Card in one's inventory. Typically, the captain's command room and armory are protected this way.

Both prevent passage when closed, and are thus used to contain flooding and creatures in case of breach hulls, and to keep suspicious individuals out of sensitive areas.
Closed doors can be forced open with a crowbar or destroyed with a Plasma Cutter to allow passage in emergency situations.

Doors and hatches can also be welded shut with a Welding Tool, in which case they can no longer be opened with external signals nor the Crowbar, and must be unwelded with a Plasma Cutter.
However, creatures damage welded doors at the same rate as non-welded doors.

Doors and hatches send out an output signal when they change states: "0" for when a door closes, "1" for when it is opened. This can be used to make fail-safes and airlocks in turn giving more survivability to a ship.

    1.  Connection Panel

    1.  Docking Hatch
The Docking Hatch creates a secure airlock between two entities that players can pass between. It can connect the Submarine to other entities like Outposts and Shuttles. Both entities must have a Docking Hatch for a connection to be made.  When the connection is not active, water can freely flow in the Docking Hatch, so it's imperative that a standard hatch is also part of the setup and configured to close when the Docking Hatch is not connected to another ship or structure.  There is a prefab in the Submarine Editor to handle the wiring for this.

The Docking Hatch also includes a Power connector which acts similarly to a Junction Box power connection in that it relays power between the two connected entities.  You should make sure your Docking Hatch's power is connected to your grid so it can benefit from the free power provided by Outposts.  Outposts seem to regulate power consumption perfectly so you can take all the juice for charging batteries and running fabricators without worrying about overloads and your Reactor can be shutdown to save fuel.

    1.  Gallery

## Electric Discharge Coil
The Electric Discharge Coil is a submarine installed weapon. It is a short range electric shock, dealing burn damage and a moderate duration stun in an area around itself. Additionally, the shock can travel along the hull of the submarine, shocking anything touching the hull. It has a massive power draw and therefore should be used tactically.

    1.  Damage
Most discharge coils have a 5 meter radius.

    1.  Default Submarines
The following Default submarines feature the Electric Discharge Coil:

The Dugong, located on the fore topside.

The Orca, located on the keel. The Orca's Discharge Coil has a 10m radius and bounces further along the hull.

The Remora, located on the keel.

The Typhon 1, located on the keel.

The Typhon 2, located on the fore topside.

The Kastrull, located on the middle topside.

The Berilia, located on the keel.

## Electrical Discharge Coil
The Electrical Discharge Coil is an installation that, when activated, sends an electric shock to nearby creatures, dealing damage and stunning them for a short time.

    1.  Function
Electrical Discharge Coils are typically used to provide defence for a submarine's blind spots.

They emit an electrical shock when activated, stunning creatures for a short time and burning them.

The shock only travels a limited length, but can travel further through walls. This can be changed in the sub editor.

    1.  Usage
When a signal is sent to the "trigger_in" pin of the Discharge Coil, the coil shocks the area around itself.

By default it has a 5m radius, travels 25x further through walls, and has a duration of 0.2 seconds.

    1.  Damage Values

    1.  Connection Panel
Hover over pins to see their descriptions.

    1.  Audio

## Engines
The Engine, Large Engine, and Shuttle Engine are all vital Installations that allow a submarine to move in water.

    1.  Function
The engines only work if they receive a signal. This can be accomplished by connecting the velocity_x_out output of the navigation terminal to the set_force input of the engine.

There are three types of engines in the game, the large engine, engine, and shuttle engine. The large engine is by far the fastest of the bunch but is very power hungry, take a whole 4000kW to power the beast. The normal engine is smaller than the large engine and goes half as fast, but requires half the amount of power to power it at 2000kW. Finally the shuttle engine is the smallest of the bunch and goes a minute amount of thrust, but only requires 500kW to power it.

While full-sized engines can quickly succumb to water damage, shuttle engines are 100% waterproof, not deteriorating while surrounded by water. A Mechanic is able to fix either by using a wrench. However, in the steam version, anyone is able to fix the engines this, however this is considerably slower than if a Mechanic was to fix it.

When the set_force of an engine is unwired, it is possible to use the plus and minus buttons on the engine's GUI interface to set its force manually (on a slider scale from -100% to 100%).

    1.  Connection Panel

    1.  Audio

    1.  Trivia
-  It is also possible, to connect the velocity_y_out output of the navigation terminal to the set_force input of the engine to steer submarine, but the controls will be inverted when steering the submarine (vertical control will become horizontal).

## Fabricator & Deconstructor
The Fabricator and the Deconstructor are a set of installations that create and destroy items, respectively.

    1.  List of items
'Construction Level' only takes effect when fabricating. It has no effect on deconstruction.
    1.  Fabricator Items

    1.  Deconstructor Items

    1.  Connection Panel

    1.  Audio

## Junction Box
Images appreciated

The Junction Box is an installation which serves as a hub for power distribution and relaying signals between devices. For this reason, it is usually a crucial part of the submarine's wiring.

    1.  Function
The Junction Box can take five different wires each connected to the one power output and the four signal outputs. If junction boxes are provided with 4.000 power units more than used by the connected devices or submerged in water, they overload and become unusable until repaired. This is a potentially dangerous situation, as important installations and items can thus become unpowered during an emergency situation. For this reason, it is usually unwise to connect more than one reactor to a chain of junction boxes without taking precautions. As well, it is best to keep the junction boxes away from water as much as possible. A way to avoid overload its by connecting one or more junction boxes to a battery.

Alternatively the power to certain junction boxes can be disabled entirely, as they won't take damage while underwater in an inactive state.

    1.  Usage
In order to edit the connections on a junction box, a screwdriver must be equipped in one of the two hand slots, and then the Junction Box left-clicked when highlighted. To add a wire to a connection, a wire must be equipped in the other hand, either before or after the Junction Box has been left-clicked.

    1.  Damage Values

    1.  I/O Interface

    1.  Gallery

## Ladder
The Ladder is a simple interactive installation. It is used to travel vertically.

    1.  Function
Allows the crew to move vertically. It can be climbed by multiple people at once.

Ladders can not be damaged and do not have collision.

    1.  Usage
By going near a ladder the player can climb up or down by holding W or S.

Holding SHIFT while going down a ladder will make the player slide down the ladder instead of climbing down.

Sliding down a ladder is much faster than climbing down.

While wearing a Diving Suit on a ladder the player can hold SHIFT to climb the ladder faster.

Note that any stun effect or sudden force will knock the player off a ladder.

While moving up or down, the character's aim is forced upwards.

    1.  Gallery

## Medical Fabricator
The Medical Fabricator is an installation which allows the crew to create different types of Chemicals and Medical Items.

=List of Medical Items=

=List of Chemicals=

## Navigation Terminal
current steam version]].

The Navigation Terminal is an installation in Barotrauma. It is an essential installation in any submarine, as it allows the crew to steer the submarine.

    1.  Usage
Using the Navigation Terminal will show its GUI, it displays an outline of the submarine and a reticle to steer the submarine.

The sonar can either be passive or active:

While active the submarine will send a sonar ping in a 360 degree arc, anything it bounces off will be displayed on the GUI.
Another option while active is Directional Ping, if enabled the submarine will send sonar pings in 30 degree arcs in the selected direction instead. It should be noted that active sonar will very easily acquire the attention of any roaming sea creatures nearby.

While passive instead of sending out sonar pings, the Navigation Terminal will scan for sound signatures, they can be generated by the submarine itself (nuclear reactor, engines) or underwater Creatures. Similarly to active sonar, these sound signatures will bounce off of their surroundings and are displayed on the GUI, the range of passive sonar is dependent on how loud the submarine is. Passive sonar is much less likely to alert any nearby creatures, though if the submarine is particularly loud or in close proximity its possible to be still be attacked.

    1.  Wiring
Alongside power, several other wiring connections are required for proper submarine function; the Engine, Ballast Pumps, and Docking Hatch must be connected.

    1.  Engine
For the engine to respond to the navigation reticle, the velocity_x_out output of the navigation terminal must be wired to the set_force input of the engine.

    1.  Ballast Pumps
For the ballast pumps to respond to the navigation reticle, the velocity_y_out output of the navigation terminal must be wired to the set_targetlevel inputs of any ballast pumps.

    1.  Docking Hatch
For the docking hatch to respond to the docking button that appears below the navigation terminal when near dock, the toggle_docking output of the navigation terminal must be wired to the toggle_state input of the docking hatch.

There is also the transducer_in input, which will allow the navigation terminal's sonar options to control a Sonar Transducer. This is primarily used for shuttles and drones.

    1.  Connection Panel

    1.  Audio

## Nuclear Reactor
0.10.5.1

The nuclear reactor is the most crucial installation found in Barotrauma. It acts as the submarine's main power source for all installations.

    1.  Function
The nuclear reactor's function is to generate power for other installations on the submarine. As long as the reactor is active, every other connected device on the ship will remain active as well. Power generated by the reactor is sent to other installations via wiring. Power distribution requires Junction Boxes to work, as the reactor cannot send power to other installations directly. Maintaining the power network is one of the most important aspects of a round, as the submarine cannot function without power.

The nuclear reactor undergoes a process called nuclear fission, in which atoms are split apart, cause large amounts of energy to be released. The rate at which these reactions take place is measured by the fission rate. The resulting reaction also causes heat to be released that raises the overall temperature of the reactor. If the temperature raises past 6,000 degrees for too long, the reactor will catch on Fire. If the temperature stays over 6000 degrees for too long, it will meltdown, creating a massive radioactive explosion. It is possible to fix the submarine and reactor after a meltdown, but it is difficult due to radiation and lack of power and, often, walls. Because of this, the cooling and fission rates must be adjusted to keep the temperature at a desired level - which is usually the same as the amount of power consumed by the electrical grid of the submarine.

Fuel Rods are required for the nuclear reactor to function. The reactor can hold up to four rods. They will be slowly consumed at a rate proportionate to the Fission Rate. Fuel Rods can be removed and replaced at any time.

If the reactor is in water, it will take damage over time, down to 10% condition.

Even when not in water, a reactor will slowly deteriorate over time, requiring maintenance. A reactor will not deteriorate below 10% condition.

If the reactor reaches 0% condition, it will instantly meltdown.

    1.  Mechanics

    1.  Turbine output
Turbine Output is how much electricity the reactor will output, which you want to modify based on the load that the ship wants. So if you need 2000KW instead of 1000KW, you would need to double the turbine output slider.

Note: if the reactor outputs more power than is needed, you get electrical damage to junction boxes.

The Turbine in turn works off heat. If there isn't enough heat, then the turbine can't produce the output it is set to. The turbine is merely capped by whether or not it has enough heat. It does not produce more power via excess heat. It only produces as power as it is set to, as long as it has enough (or more than enough) heat to sustain that level of power output.

## Oxygen Generator
The Oxygen Generator is an installation found in Barotrauma. It is used in junction with vents to supply the submarine with oxygen.

    1.  Function
The oxygen generator is used to pump and maintain airflow throughout the entire submarine. The way airflow is pumped from the oxygen generator into the rest of the submarine is through vents. Vents will supply any nearby area with oxygen, so long as the generator is active.

The Oxygen Generator can also hold up to 5 Oxygen Tanks, which will get refilled as long as the Oxygen Generator has power. In the event that the generator loses power, the airflow will stop and any crew members onboard will (after some time) suffocate.

It is possible to remain alive after the generator stops if the player has an Oxygen Tank attached to a Diving Mask or Diving Suit. Although this method will only stall the suffocation, it can be used to provide the player enough time to re-active the generator.
In the event of a Fire, the Oxygen Generator poses a hazard to the crew, as it will explode if left to burn, along with any stored Oxygen Tanks.

    1.  Connection Panel

    1.  Trivia
- With the Steam Release, the Shuttle Oxygen Generator was added, a functionally identical variant of the Oxygen Generator (besides the smaller size and the fact that it does not display Oxygen Tanks).
- Unlike most sprites in the game, Vents are animated.

    1.  Audio

## Oxygen Tank Shelf
The Oxygen Tank Shelf is an installation found in Barotrauma. When Powered, It refills oxygen tanks oxygen level.

Function

Oxygen Tank Shelf holds up to 3 oxygen tanks,
and when powered, refills their oxygen level.

## Periscope
The Periscope is a stationaryinstallations in Barotrauma. It's meant to be connected to different installations, such as the Coilgun, Railgun, Searchlight and Camera.

    1.  Function
Periscope need to be wired up to another installation in order to function.

## Pumps
The pump is an installation found in Barotrauma. It is used to pump water out of or into the submarine.

    1.  Function
The pump's primary function is to pump water into and out of its given area. By using the pump, a small menu will appear in which the player is able to manually activate/disable the Pump and modify both the direction the water is being pumped into and the speed at which it is being pumped. For instance, setting the pump slider towards IN will cause water to flood into the Submarine, while dragging the slider towards OUT will pump water out of the area. The slider can be adjusted to regulate the Speed at which the Pump interacts with Water.

In addition to the obvious use for the pumps, to pump out water when a flood occurs, they can also be used to control the vertical movement of the sub, or to extinguish fires.

As of the Steam Release, the normal Pump is often used as part of the Ballast, and linked with the Navigation Terminal to automate the process, while the Small Pumps are used in Airlocks and spread throughout the Submarine, and may be linked with a Water Detector to automate its use, or require manual interaction.

    1.  Ballast
Ballast pumps are pumps wired to achieve a certain water level in the room they are in, thereby controlling the buoyancy of the submarine, which determines its vertical acceleration.

This is usually done by wiring the pump's set_targetlevel  input to the Navigation Terminal's velocity_y_out output. The target level accepts decimal values from -100 to 100, for pumping the room to a water level of 0 and 100 respectively. When a velocity is set, the pumps direction is automatically set and it will begin lowering or raising the water level to the appropriate level.

This and a power input are all that is required for a ballast pump to function correctly.

    1.  Bilge
Bilge pumps are pumps wired to remove water from the sub. The usual configuration is for water to flow through ducts to the bottom of the sub, where water detectors trigger the bilge pumps to remove it.

A simple circuit would have a water detector passing a signal of 1 to the set_state input of the pump, and also to a signal component, which will send an output of -100 and a false output of 0 to for a target signal of 1 to the set_speed input of the pump. In this way, the pump is only active and deteriorating when water is in the room, and will pump at maximum speed until the room is empty.

    1.  GUI

    1.  Connection Panel

    1.  Audio

    1.  Gallery

## Railgun
The railgun is a stationary weapon in Barotrauma. It is technically composed of three installations: the railgun proper (which itself is made up of the base and barrel), the periscope, and the railgun loader.

    1.  Function
The railgun uses railgun shells as ammunition. Those must be loaded by hand in the railgun loader; up to 5 shells can be loaded at a time, though more are possible if there are multiple loaders. Railgun shells are hollow and can be filled with an item. The payload will be activated on impact. Explosives in particular can be loaded in shells to greatly increase damage potential.

Nuclear Railgun Shells are special ammunitions of extreme destructive power, which can be precious to bring down some creatures, such as a Moloch or a Charybdis. Due to the large radius of the ensuing explosion, it is however highly recommended to use this type of ammunition at a distance.

The best railgun ammunition comes in the form of the Ancient Weapon, which is incredibly rare. While the damage it does against Creatures is the same as the Nuclear Railgun Shell, the resulting explosion does five times more damage against structures than the Nuclear Railgun Shell, making it ideal for submarine VS submarine combat.

A railgun loader must be connected to one or more railguns proper in the submarine editor, it can not be connected outside of the editor.

A railgun controller is connected to one or more railguns proper with wiring through their respective connection panels. Both the railgun controller and the railgun proper require power to function; however, the railgun loader does not require any power. A railgun proper requires a supercapacitor, which needs to be charged before firing, and each shot will use up some amount of this store to function as its power supply in order to be able to fire. Connecting the railgun proper directly to the power network will leave it unable to fire. Note that attempting to fire a railgun with no shell loaded doesn't empty the capacitor.

The railgun proper, when edited in the submarine editor, is given a pair of numbers under RotationLimits formatted thus: 0,180. These numbers are angles that describe the limits that the railgun proper can be rotated when aiming. A railgun proper with the RotationLimits set at 0,180 will be able to rotate from the right down and around to the left. A railgun proper with its RotationLimits set at 180,360, contrastingly, will be able to rotate from the left up and around to the right.

    1.  Usage
To use a railgun, the character must be positioned in front of a periscope wired to the railgun. When the periscope is highlighted, press the left mouse button. The railgun can then be used and fired, using a shell loaded in the associated railgun loader(s), by clicking the left mouse button. To leave the periscope you have to press the right mouse button.

    1.  Damage Values
Railgun shells (excepting the Nuclear Shell) pierce through 3 targets.

## Railgun Loader
The Railgun Loader is used for loading Railgun Shells Nuclear Shells into a Railgun. It is the Railgun's magazine, each shell has to be loaded individually. It has two variants, a large can hold up to 5 shells and a single loader that fits a single shell.

    1.  Usage
Upon interacting with the railgun loader, it will open a GUI table of slots for shells. From here the player can drag and drop shells into the table to load them. Shells can also be directly loaded from the main screen by dragging the shell from the player's inventory onto the railgun loader. It takes two hands to hold a shell.

    1.  Gallery

## Searchlight
Searchlight are stationary installations for shining light outside of the submarine.

    1.  Function
Searchlight can be useful for shining light in the dark deep waters. It projects light in a narrow, long cone towards where the Searchlight is aiming, useful for seeing potential targets or generally observing the outside of the submarine. This light can be toggled using the toggle_state wiring pin.

The Periscope is where a crewmember operates the Searchlight . In the submarine editor, the Periscope must be wired to the Searchlight where the Searchlight's position_in pin. Only one crewmember can operate a Periscope at a time. The connected Searchlight is aimed using a crosshair that replaces the mouse when interacting with the Periscope.

    1.  Connection Panel

## Sonar Monitor
The Sonar Monitor is an installation in Barotrauma. It displays the sonar values.

    1.  Usage
Using the Sonar Monitor will show its GUI, it displays the sonar GUI. It also has the option to scan for minerals.

    1.  I/O Interface

## Sonar Transducer
The Sonar Transducer is an installation in Barotrauma. It generates sonar, usually for drones or shuttles.

    1.  Usage
Wire the Sonar Transducer to a monitor to pulse.

    1.  I/O Interface

## Status Monitor
Although it is similar to the current steam version, the Aegir its a legacy sub so needs an update

The Status Monitor is an installation in Barotrauma. It can allow players to quickly ascertain the water level, hull integrity, and oxygen level in each section of the submarine, making attempts to find and fix problems much easier.

    1.  Usage
Using the Status Monitor will bring up a schematic of the current submarine, in which every area is represented by light-bordered rectangles. The rectangles represent each of the Hull sections designated in the Submarine Editor, which equate to rooms.

The Status Monitor gives a live update to show the status of each room. The current level of water in that section is signified by the room on the monitor filling up with the color blue. Hull breaches will turn the room outline through orange to red depending on severity of damage. Rooms turning from black to red depict the decreasing oxygen in a room. Areas containing pumps, such as ballast tanks and airlock, will display with a blue color on the outline. Hovering over a room on the status monitor will show you the room name and other data about the room.

    1.  Submarine Editor
Options in the Submarine Editor allow you to not require water or oxygen detectors in order to display water and oxygen data, as well as disable hull integrity display.

The labels for each room are taken from the Room Name of each Hull object, and can be custom set or picked from a list of pre-existing names

    1.  I/O Interface

    1.  Gallery

## Steel Cabinet
Containers page is more compact Containers.

Steel cabinets, also referred to as lockers, are simple installations that act as a storage space. They prove beneficial in freeing up space in a crew member's inventory, as well as organizing items in general.

    1.  Usage
Upon interacting with a large steel cabinet, it will open a GUI table of slots for items. From here the player can drag and drop items into the table to store them. They can hold up to a max of 30 items.
Medium steel cabinets can hold up to 15 items. Secure steel cabinets can hold 15 items, but they usually can only be accessed by captains or security guards.

    1.  Gallery

    1.  Submarine Editing
Once placed, cabinets placed using the submarine editor can be set to auto-populate with appropriate items. To accomplish this, you must add the appropriate tags in the "Tags" field. See below for a table showing what items are included in each tab.

Additionally, the Secure Steel Cabinet can be set to only be accessible by crew members carrying a specific id tag. To accomplish this, enterthe desired id(s) into the "Picking required" field that is shown when the safe is selected in the submarine editor. Note that this mechanic is identical to the one used to secure doors against certain member of the crew.

Values below are taken from materials.xml, medical.xml, medmaterials.xml, tools.xml, weapons.xml, and buffs.xml, and is accurate as of v0.9.8.0.

{| class="wikitable sortable"
|-
! Item !! storagecab !! medfabcab !! toxcab !! medcab !! supplycab !! secarmcab !! armcab !! weaponholder !! crewcab
|-
|carbon || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|iron || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|tin || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|lead || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|phosphorus || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|copper || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|zinc || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|sodium || Yes || Yes ||  ||  ||  ||  ||  ||  ||
|-
|silicon || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|calcium || Yes || Yes ||  ||  ||  ||  ||  ||  ||
|-
|aluminium || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|uranium || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|potassium || Yes || Yes ||  ||  ||  ||  ||  ||  ||
|-
|titanium || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|magnesium || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|lithium || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|chlorine || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|thorium || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|steel || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|titaniumaluminiumalloy || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|plastic || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|ballisticfiber || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|organicfiber ||  || Yes ||  ||  ||  ||  ||  ||  ||
|-
|rubber || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|flashpowder || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|incendium || Yes ||  ||  ||  ||  || Yes || Yes ||  ||
|-
|fulgurium || Yes ||  ||  ||  ||  ||  ||  ||  ||
|-
|physicorium || Y

## Supercapacitor
Supercapacitors are stationary installations able to store and release electrical power much quicker than conventional batteries, but with limited ability to store up energy.

    1.  Function
Supercapacitors are used to provide short bursts of high energetic output to relevant installations, such as the Railgun and Coilgun.

    1.  Damage Values

    1.  I/O Interface

## Terminal
The Terminal is an electrical component used to obtain typed text.

It is most commonly used in tandem with a RegEx Find Component to provide advanced user interaction.

Hover over pins to see their descriptions
