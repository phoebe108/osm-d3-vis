/* The following is based on http://vallandingham.me/scroller.html*/
/**
 * scrollVis - encapsulates
 * all the code for the visualization
 * using reusable charts pattern:
 * http://bost.ocks.org/mike/chart/
 */
var scrollVis = function () {
    // constants to define the size
    // and margins of the vis area.
    var width = 600;
    var height = 520;
    var margin = {top: 0, left: 20, bottom: 40, right: 10};

    // keep track of current and previous visuals
    var lastIndex = -1;
    var activeIndex = 0;

    // Sizing for the grid visualization
    var squareSize = 6;
    var squarePad = 2;
    var numPerRow = width / (squareSize + squarePad);

    // main svg used for visualization
    var svg = null;

    // d3 selection that will be used
    // for displaying visualizations
    var g = null;

    // We will set the domain when the
    // data is processed.
    var xBarScale = d3.scale.linear()
        .range([0, width]);

    // The bar chart display is horizontal
    // so we can use an ordinal scale
    // to get width and y locations.
    var yBarScale = d3.scale.ordinal()
        .domain([0, 1, 2])
        .rangeBands([0, height - 50], 0.1, 0.1);

    // color is determined just by the index of the bars
    var barColors = {0: "#008080", 1: "#399785", 2: "#5AAF8C"};

    // so the range goes from 0 to 30
    var xHistScale = d3.scale.linear()
        .domain([0, 30])
        .range([0, width - 20]);

    var yHistScale = d3.scale.linear()
        .range([height, 0]);

    // convert progress through a section into a color value
    var coughColorScale = d3.scale.linear()
        .domain([0, 1.0])
        .range(["#008080", "red"]);

    var xAxisBar = d3.svg.axis()
        .scale(xBarScale)
        .orient("bottom");

    var xAxisHist = d3.svg.axis()
        .scale(xHistScale)
        .orient("bottom")
        .tickFormat(function (d) {
            return d + " years";
        });

    var activateFunctions = [];
    var updateFunctions = [];

    // divide data into quantiles
    var quantize = d3.scale.quantize()
        .domain([0, 9000])
        .range(d3.range(9).map(function (i) {
            return "q" + i + "-9";
        }));

    /* CHART FUNCTION */
    var chart = function (selection) {
        selection.each(function (rawData) {
            // create svg and give it a width and height
            svg = d3.select(this).selectAll("svg").data([rawData]);
            svg.enter().append("svg").append("g");

            svg.attr("width", width + margin.left + margin.right);
            svg.attr("height", height + margin.top + margin.bottom);


            // this group element will be used to contain all
            // other elements.
            g = svg.select("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // map projection
            var projection = d3.geo.albersUsa()
                .scale(800)
                .translate([width / 2, height / 2]);

            // define path type
            var path = d3.geo.path()
                .projection(projection);

            //console.log(wordCloudData);
            var wordmap = processText(rawData[2]);

            // Parse a body of text into sorted word counts.
            function processText(wordCloudData) {
                var unique_word_counts = {};

                wordCloudData.forEach(function (element) {
                    unique_word_counts[element.word] = +element.count;
                });

                //console.log(unique_word_counts);
                var wordmap = d3.entries(unique_word_counts).sort(function (a, b) {
                    return b.value - a.value;
                });
                //console.log(wordmap);
                return wordmap;
            }

            setupVis(rawData[0], path, wordmap);

            setupSections();
        });
    };


    // create initial elements for all sections
    setupVis = function (mapData, mapPath, wordCloudData) {
        // axis
        g.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxisBar);
        g.select(".x.axis").style("opacity", 0);

        // title
        g.append("text")
            .attr("class", "title osm-title")
            .attr("x", width / 2)
            .attr("y", height / 3)
            .text("OSM");

        g.append("text")
            .attr("class", "sub-title osm-title")
            .attr("x", width / 2)
            .attr("y", (height / 3) + (height / 5))
            .text("Tags");

        g.selectAll(".osm-title")
            .attr("opacity", 0);

        // subtitle
        g.append("text")
            .attr("class", "and womensday-title")
            .attr("x", width / 2)
            .attr("y", height / 4)
            .style("font-size", "90px")
            .style("fill", "rgb(222,62,49)")
            .text("&")
            .attr("opacity", 0);

        g.append("text")
            .attr("class", "title womensday-title")
            .attr("x", width / 2)
            .attr("y", (height / 3) + (height / 20))
            .style("font-size", "50px")
            .text("International")
            .attr("opacity", 0);

        g.append("text")
            .attr("class", "title womensday-title")
            .attr("x", width / 2)
            .attr("y", (height / 3) + (height / 5))
            .style("font-size", "50px")
            .text("Women's Day")
            .attr("opacity", 0);

        /* Map */
        // topojson converted back to geojson for rendering
        var states = topojson.feature(mapData, mapData.objects.usa_states);

        var map = g.selectAll(".map").data(states.features);

        // add class to each state depending on state name (using map object created above)
        map.enter().append("path")
            .attr("class", function (d) {
                //console.log(d.properties.ADM1_NAME, quantize(valueByState.get(d.properties.ADM1_NAME)));
                return "map " + quantize(valueByState.get(d.properties.ADM1_NAME));
            })
            .attr("d", mapPath)
            .attr("opacity", 0);

        // state borders
        g.append("path")
            .datum(topojson.mesh(mapData, mapData.objects.usa_states, function (a, b) {
                return a !== b;
            }))
            .attr("class", "map stateBorders")
            .attr("d", mapPath)
            .attr("opacity", 0);

        /* WordCloud */
        // code based on https://www.blockspring.com/blog/d3-and-node
        var rotate_words = false;

        // draw wordcloud.
        var cloud = d3.layout.cloud;
        var max = Math.min(width / 5, height / 5, 100),
            font_size = d3.scale.linear()
                .domain([1, d3.max(wordCloudData, function (d) {
                    return d.value;
                })])
                .range([max / 10, max]),
            fill = d3.scale.category20();

        // start cloud simulation to figure out where words should be placed.
        cloud().size([width, height])
            .words(wordCloudData)
            //.timeInterval(20)
            .padding(2)
            .spiral("rectangular")
            .fontSize(function (d) {
                return font_size(d.value);
            })
            .font("Impact")
            .text(function (d) {
                return d.key;
            })
            .rotate(function () {
                return rotate_words ? (~~(Math.random() * 2) * 90) : 0;
            })
            .on("end", function (words) {
                g
                    .append("g")
                    .attr("transform", "translate(" + [width >> 1, height >> 1] + ")")
                    .selectAll("text")
                    .data(words)
                    .enter()
                    .append("text")
                    .attr("class", "cloudword")
                    .attr("opacity", 0)
                    .style("font-family", "Impact")
                    .style("font-size", function (d) {
                        return font_size(d.value) + "px";
                    })
                    .style("fill", function (d, i) {
                        return fill(i);
                    })
                    .attr("text-anchor", "middle")
                    .attr("transform", function (d) {
                        return "translate(" + [d.x, d.y] + ")";
                    })
                    .text(function (d) {
                        return d.key;
                    });
            })
            .start();

        /*Line Graph*/
        // code based on http://bl.ocks.org/markmarkoh/8700606
        var parse = d3.time.format("%b %Y").parse;

        // Scales and axes. Note the inverted domain for the y-scale: bigger is up!
        var x = d3.time.scale().range([0, width]),
            y = d3.scale.linear().range([height, 0]),
            xAxis = d3.svg.axis().scale(x).tickSize(-height).tickSubdivide(true),
            yAxis = d3.svg.axis().scale(y).ticks(4).orient("right");

        // An area generator, for the light fill.
        //var area = d3.svg.area()
        //    .interpolate("monotone")
        //    .x(function(d) { return x(d.date); })
        //    .y0(height)
        //    .y1(function(d) { return y(d.price); });

        // A line generator, for the dark stroke.
        var line = d3.svg.line()
            .interpolate("monotone")
            .x(function (d) {
                return x(d.date);
            })
            .y(function (d) {
                return y(d.price);
            });

        d3.csv("../data/readme.csv", type, function (error, data) {

            // Filter to one symbol; the S&P 500.
            var values = data.filter(function (d) {
                return d.symbol == "AMZN";
            });

            var msft = data.filter(function (d) {
                return d.symbol == "MSFT";
            });

            //var ibm = data.filter(function (d) {
            //    return d.symbol == 'IBM';
            //});

            // Compute the minimum and maximum date, and the maximum price.
            x.domain([values[0].date, values[values.length - 1].date]);
            y.domain([0, d3.max(values, function (d) {
                return d.price;
            })]).nice();

            // Add an SVG element with the desired dimensions and margin.
            //var svg = d3.select("svg")
            //    .attr("width", width + margin.left + margin.right)
            //    .attr("height", height + margin.top + margin.bottom)
            //    .append("g")
            //    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            // Add the clip path.
            //g.append("clipPath")
            //    .attr("id", "clip")
            //    .append("rect")
            //    .attr("width", width)
            //    .attr("height", height);

            // Add the x-axis.
            g.append("g")
                .attr("class", "x axis")
                .attr("transform", "translate(0," + height + ")")
                .attr("opacity", 0)
                .call(xAxis);

            // Add the y-axis.
            g.append("g")
                .attr("class", "y axis")
                .attr("transform", "translate(" + width + ",0)")
                .attr("opacity", 0)
                .call(yAxis);

            var colors = d3.scale.category10();
            g.selectAll('.line')
                .data([values, msft, /*ibm*/])
                .enter()
                .append('path')
                .attr('class', 'line')
                .attr('opacity', 0)
                .style('stroke', function (d) {
                    return colors(Math.random() * 50);
                })
                //.attr('clip-path', 'url(#clip)')
                .attr('d', function (d) {
                    return line(d);
                });

            // add 'curtain' rectangle to hide entire graph
            var curtain = g.append('rect')
                .attr('x', -1 * width)
                .attr('y', -1 * height)
                .attr('height', height)
                .attr('width', width)
                .attr('class', 'curtain')
                .attr('transform', 'rotate(180)')
                .style('fill', '#ffffff')
                .attr("opacity", 0);

            /* Optionally add a guideline */
            //var guideline = g.append('line')
            //    .attr('stroke', '#333')
            //    .attr('stroke-width', 0)
            //    .attr('class', 'guide')
            //    .attr('x1', 1)
            //    .attr('y1', 1)
            //    .attr('x2', 1)
            //    .attr('y2', height);

            //// create a shared transition for anything we're animating
            //var t = g.transition()
            //    .delay(750)
            //    .duration(6000)
            //    .ease('linear')
            //    .each('end', function() {
            //        d3.select('line.guide')
            //            .transition()
            //            .style('opacity', 0)
            //            .remove()
            //    });
            //
            //t.select('rect.curtain')
            //    .attr('width', 0);
            //t.select('line.guide')
            //    .attr('transform', 'translate(' + width + ', 0)');

            //d3.select("#show_guideline").on("change", function(e) {
            //    guideline.attr('stroke-width', this.checked ? 1 : 0);
            //    curtain.attr("opacity", this.checked ? 0.75 : 1);
            //})

        });

        // Parse dates and numbers. We assume values are sorted by date.
        function type(d) {
            d.date = parse(d.date);
            d.price = +d.price;
            return d;
        }
    };

    // associate each section to its correct visual
    // scroller.js will broadcast "active" and the index of the current section
    setupSections = function () {
        // activateFunctions are called each
        // time the active section changes
        activateFunctions[0] = showTitle;
        activateFunctions[1] = showSubTitle;
        activateFunctions[2] = showWordCloud;
        activateFunctions[3] = showLineGraph;
        activateFunctions[4] = showMapPart;
        activateFunctions[5] = showMapAll;

        for (var i = 0; i < 6; i++) {
            updateFunctions[i] = function () {
            };
        }
    };

    /* ACTIVATE FUNCTIONS */

    // hide subtitle and show title
    function showTitle() {
        g.selectAll("g")
            .selectAll(".cloudword")
            .transition()
            .duration(300)
            .delay(function (d, i) {
                return 200 * (1 / parseInt(d.value));
            })
            .style("opacity", 0);

        g.selectAll(".womensday-title")
            .transition()
            .duration(600)
            .attr("opacity", 0);

        g.selectAll(".osm-title")
            .transition()
            .duration(1200)
            .attr("opacity", 1.0);
    }

    // hide title and word cloud, and show subtitle
    function showSubTitle() {
        g.selectAll(".osm-title")
            .transition()
            .duration(0)
            .attr("opacity", 0);

        g.selectAll("g")
            .selectAll(".cloudword")
            .transition()
            .duration(300)
            .delay(function (d, i) {
                return 200 * (1 / parseInt(d.value));
            })
            .style("opacity", 0);

        g.selectAll(".womensday-title")
            .transition()
            .duration(600)
            .attr("opacity", 1.0);
    }

    // hide subtitle and line graph, show word cloud
    function showWordCloud() {
        g.selectAll(".womensday-title")
            .transition()
            .duration(600)
            .attr("opacity", 0);

        g.selectAll(".curtain")
            .transition()
            .duration(0)
            .attr("opacity", 0);

        g.selectAll(".axis")
            .transition()
            .duration(0)
            .attr("opacity", 0);

        g.selectAll('.line')
            .transition()
            .duration(0)
            .attr("opacity", 0);

        g.selectAll("g")
            .selectAll(".cloudword")
            .transition()
            .duration(400)
            .delay(function (d) {
                return 600 * (1 / parseInt(d.value));
            })
            .style("opacity", 1.0);
    }

    // hide word cloud and map, and show line graph
    function showLineGraph() {
        g.selectAll("g")
            .selectAll(".cloudword")
            .transition()
            .duration(600)
            .delay(function (d, i) {
                return 400 * (1 / parseInt(d.value));
            })
            .style("opacity", 0);

        g.selectAll(".map")
            .transition("visibility")
            .duration(0)
            .attr("opacity", 0);

        g.selectAll(".curtain")
            .transition()
            .duration(0)
            .attr("opacity", 1.0);

        g.selectAll(".axis")
            .transition()
            .duration(600)
            .attr("opacity", 1.0);

        g.selectAll('.line')
            .transition()
            .duration(600)
            .attr("opacity", 1.0);

        // create a shared transition for anything we're animating
        var t = g.transition()
            .delay(750)
            .duration(2000)
        .ease('linear')
        .each('end', function() {
            d3.select('line.guide')
                .transition()
                .style('opacity', 0)
                .remove()
        });

        t.select('rect.curtain')
            .attr('width', 0);
        t.select('line.guide')
            .attr('transform', 'translate(' + width + ', 0)');
    }

    // hide line graph and whole map, and show part map
    function showMapPart() {
        g.selectAll(".map:not(.q8-9)")
            .transition("visibility")
            .duration(600)
            .delay(function (d, i) {
                return 10 * (i + 1);
            })
            .attr("opacity", 0);

        g.selectAll(".q8-9")
            .transition()
            .duration(600)
            .attr("opacity", 1.0);

        g.selectAll(".curtain")
            .transition()
            .duration(0)
            .attr('x', -1 * width);

        g.selectAll(".curtain")
            .transition()
            .duration(30)
            .attr("opacity", 0);

        // create a shared transition for anything we're animating
        var t = g.transition()
            .delay(750)
            .duration(6000)
            .ease('linear')
            .each('end', function() {
                d3.select('line.guide')
                    .transition()
                    .style('opacity', 0)
                    .remove()
            });

        t.select('rect.curtain')
            .attr('x', -1 * width);
        t.select('line.guide')
            .attr('transform', 'translate(' + width + ', 0)');

        g.selectAll(".axis")
            .transition()
            .duration(0)
            .attr("opacity", 0);

        g.selectAll('.line')
            .transition()
            .duration(0)
            .attr("opacity", 0);
    }

    // add the other states to the map
    function showMapAll() {
        g.selectAll(".map")
            .transition("visibility")
            .duration(600)
            .delay(function (d, i) {
                return 10 * (i + 1);
            })
            .attr("opacity", 1.0);
    }

    // activate chart on active index
    chart.activate = function (index) {
        activeIndex = index;
        var sign = (activeIndex - lastIndex) < 0 ? -1 : 1;
        var scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);
        scrolledSections.forEach(function (i) {
            activateFunctions[i]();
        });
        lastIndex = activeIndex;
    };

    // update current index
    chart.update = function (index, progress) {
        updateFunctions[index](progress);
    };

    // return chart function
    return chart;
};

// setup scroller and display visualization once data has been loaded
function display(error, data1, data2, data3, data4) {

    if (error) throw error;

    // create a new plot and
    // display it
    var plot = scrollVis();
    d3.select("#vis")
        .datum([data1, data2, data3, data4])
        .call(plot);

    // setup scroll functionality
    var scroll = scroller()
        .container(d3.select('#graphic'));

    // pass in .step selection as the steps
    scroll(d3.selectAll('.step'));

    // setup event handling
    scroll.on('active', function (index) {
        // highlight current step text
        d3.selectAll('.step')
            .style('opacity', function (d, i) {
                return i == index ? 1 : 0.1;
            });

        // activate current section
        plot.activate(index);
    });

    scroll.on('progress', function (index, progress) {
        plot.update(index, progress);
    });
}

// create an array-mapping instance for map data
var valueByState = d3.map();

// get data and continue once data is ready
queue()
    .defer(d3.json, "../data/usa_states_topo.json")
    .defer(d3.csv, "../data/map_data.csv", function (d) {
        valueByState.set(d.adm1_name, +d.count);
    })
    .defer(d3.csv, "../data/word_cloud_data.csv")
    .await(display);

// d3.csv("../data/readme.csv", type, function(error, data) {...