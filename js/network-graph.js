/////////////////////////
// Filter and merge data
/////////////////////////

d3.queue()
.defer(d3.csv, "data/data.csv")
.defer(d3.csv, "data/characters.csv")    
.await(ready);

// Start queue data callback function
function ready(error, sourceTargetData, characters) {
    if(error) return console.log("error: " + error.responseText);
    
    // Create sourcetargetid (to nest on later) and type cast numbers
    sourceTargetData = sourceTargetData.map(d => ({
        sourcetargetid: `${d.source}-${d.target}`,
        source: d.source,
        target: d.target,
        weight: +d.weight,
        score: +d.score,
        date: +d.date,
    }));
    
    // Start prepareData function, calculates data for date range
    // and returns graph object with links and nodes
    function prepareData(dateStart, dateEnd) {
        // Define vars
        let graph = {};
        let links = [];
        let nodes = [];
        let data = [];
        const nodesByName = {};

        // Reset data to sourceTargetData (with type casted values)
        data = sourceTargetData;
        
        // Filter on dates chosen
        data = data.filter(({ date }) => {
            if (date >= dateStart && date <= dateEnd) return true;
        });
        
        // Nest data on sourcetargetid, sum weight, average score
        function noNaN( n ) { return isNaN( n ) ? 0 : n; }
        const groupedData = d3.nest()
        .key(({ sourcetargetid }) => sourcetargetid)
        .rollup(v => ({
            weight: d3.sum(v, ({ weight }) => weight),
            score: d3.mean(v, function (d) { return noNaN(d.score);})
        }))
        .entries(data);
        
        // Flatten the nested object to links array
        links = groupedData.map(({ key, value }) => ({
            source: key.substring(key.indexOf("-") + 1), // gets string part before the '-'
            target: key.substring(0, key.indexOf("-")), // gets string part after the '-'
            weight: value.weight,
            score: value.score
        }));
        
        // Put the node names in each source and target.
        function nodeByName(name) {
            return nodesByName[name] || (nodesByName[name] = { name })
            ;
        }
        links.forEach(link => {
            link.source = nodeByName(link.source);
            link.target = nodeByName(link.target);
        });
        
        // Extract the array of nodes from the map by name.
        nodes = d3.values(nodesByName);
        
        // Loop over the nodes and add information from data/characters.csv
        // (can be made more performant with for loop if array becomes large, 
        // see http://learnjsdata.com/combine_data.html)
        nodes.forEach(function(node) {
            var result = characters.filter(function(fullName) {
                return fullName.characterid === node.name; });
                var result2 = characters.filter(function(img) {
                    return img.characterid === node.name; });
                    node.fullName = (result[0] !== undefined) ? result[0].charactername : null;          
                    node.img = (result2[0] !== undefined) ? result2[0].img : null;
                });
                
                // Populate graph object with links and nodes as arrays
                graph = {
                    links,
                    nodes
                };
                
                return graph;
            } // end prepareData function
        
        ////////////////////////////////////////////////////////////////////////////////
        // Setup visualization vars, data binding comes later in the restart function //
        ////////////////////////////////////////////////////////////////////////////////
        
        let svg = d3.select("#graph").append("svg"),
        width = +svg.attr("width"), height = +svg.attr("height");

        // var color = d3.scaleOrdinal(d3.schemeCategory20);
        
        let graph = {
            nodes: [],
            links: [],
        };
        
        // tick handler function, needs to be put above simulation const
        function ticked() {
            link
                .attr("x1", ({ source }) => source.x)
                .attr("y1", ({ source }) => source.y)
                .attr("x2", ({ target }) => target.x)
                .attr("y2", ({ target }) => target.y);
            
            // Different tick attributes because we use images (x,y) instead of circles (cx,cy)
            // node.attr("cx", ({ x }) => x).attr("cy", ({ y }) => y);
            node.attr("x", ({ x }) => x - 12).attr("y", ({ y }) => y - 12);
            
            label.attr("x", ({ x }) => x).attr("y", ({ y }) => y);
        }
        
        const simulation = d3.forceSimulation(graph.nodes)
        .force("charge", d3.forceManyBody().strength(-800))
        .force("link", d3.forceLink(graph.links).distance(10))
        .force("x", d3.forceX())
        .force("y", d3.forceY(0.5).strength(0.18))
        .alphaTarget(1)
        .on("tick", ticked);
        
        svg.append("defs")
        .append("filter")
        .attr("id", "shadow")
        .append("feDropShadow")        
        .attr("dx", 4)
        .attr("dy", 8)
        .attr("stdDeviation", 4);
        
        const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);
        let link = g.append("g").selectAll(".link");
        let node = g.append("g").selectAll(".node");
        let label = g.append("g").selectAll(".label");
        
                   
        //////////////////////////////
        // Update the visualization //
        //////////////////////////////
        
        function updateVisualization() {
            
            let weightScale = d3.scaleLinear()
            // Use custom domain from 0 to max of the data
            .domain(customExtent)
            // .domain(d3.extent(graph.links, d => d.weight))
            .range([4, 10]);
            
            // Prepare linear scale to set link width according to weight, with a min/max of 1/15 px
            let formatScore = d3.format('.2f');
            
            // Prepare quantize scale to set link color according to score (continuous input and discrete output)
            let scoreScale = d3.scaleQuantize()
            // since we know the score ranges from -1 to 1, we can set that as the domain here
            .domain([-1,1])
            .range(['#8b0000','#e35875','#ffc7c4','#beecb5','#66b890','#008080']);
                        
            // Apply the general update pattern to the nodes.
            node = node.data(graph.nodes, ({ id }) => id);
            node.exit().remove();
            node = node.enter()
            // .append("circle").attr("fill", "grey").attr("stroke", "#fff").attr("stroke-width", 1.5).attr("r", 10)
            .append("svg:image").attr("xlink:href", function (d) { if (d.img != "") {return "img/" + d.img;} else { return "img/person-icon.png";} }).attr("height", 30).attr("width", 30)
            .merge(node)
            .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

            // Apply the general update pattern to the labels.
            label = label.data(graph.nodes, ({ id }) => id);
            label.exit().remove();
            label = label.enter().append("text").attr("fill", "grey").attr("dx", 20)
                .attr("dy", ".35em")
                .merge(label).text(function (d) { if (d.fullName != undefined) {return d.fullName;} else { return d.name;} })           
                // .style("filter:url(#shadow)")
                .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended));

            // Apply the general update pattern to the links.
            link = link.data(graph.links, ({ source, target }) => `${source.id}-${target.id}`);
            link.exit().remove();

            link = link.enter().append("line").merge(link)
                .attr("stroke-width", ({ weight }) => weightScale(weight))
                .attr("stroke", ({ score }) => scoreScale(score)).attr("stroke-opacity", 0.7);

            // Append title on hover. For some reason target and source are switched
            link.select("title").remove();
            { link.append("title").text(({ source, target, weight, score }) => `${target.fullName} - ${source.fullName}, Weight: ${weight}, Score: ${formatScore(score)}`).merge(link);}

            // Update and restart the simulation.
            simulation.nodes(graph.nodes);
            simulation.force("link").links(graph.links);
            simulation.alpha(1);
            simulation.restart();

        } // end updateVisualization function

    resize();
    
    /////////////////////////////////////
    // Build and activate the slider ////
    /////////////////////////////////////

    const minDate = +d3.min(sourceTargetData, ({ date }) => date);
    const maxDate = +d3.max(sourceTargetData, ({ date }) => date);
    const formatInteger = d3.format('.0f')
    const mediumDate = +formatInteger((maxDate + minDate) / 2);

    var slider = document.getElementById('slider');
    const formatter = wNumb({
        prefix: '',
        decimals: 0,
        edit: function( value ){
            return value.slice(0,4) + "-" + value.slice(4,6) + "-" + value.slice(6,8);
		}
    });
        slider = noUiSlider.create(slider, {
        start: [minDate, maxDate],
        connect: true,
        orientation: 'vertical',
        direction: 'rtl',       
        margin: 0,
        tooltips: [formatter, formatter],
        step: 1,
        // snap: true,
        pips: {
            mode: 'range',
            density: 5,
            format: formatter
        },
        range: {
            min: [minDate,1],
            '50%': [ mediumDate,1 ],          
            max: [maxDate,1]
        }
    });

    // // make the svg fit in the current window and center it, fires again on window resize
    d3.select(window).on("resize", resize);

    // Initial visualization loading
    graph = prepareData(minDate, maxDate);
    const customExtent = [1, d3.max(graph.links, d => d.weight)];    
    updateVisualization();
    simulation.alphaTarget(0);


    // Change visualization on slider change, also fires on page load
    slider.on('change', values => {
        graph = prepareData(values[0], values[1]);
        updateVisualization();
        simulation.alphaTarget(0);
    });

    ////////////////////////////////
    // Dragging and resize functions
    ////////////////////////////////

    // Dragging helper functions
    function dragstarted(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3);
        simulation.restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // recenter and resize function
    function resize() {
        width = window.innerWidth, height = window.innerHeight;
        svg.attr("width", width).attr("height", height);
        simulation.force("center", d3.forceCenter(width / 2, height / 2.5));
    }

} // end queue data callback function